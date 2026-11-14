use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::Path;

use mp3lame_encoder::{Bitrate, Builder, Encoder, FlushNoGap, InterleavedPcm, MonoPcm, Quality};
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::errors::Error as SymError;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

fn bitrate(kbps: u32) -> Bitrate {
    match kbps {
        0..=128 => Bitrate::Kbps128,
        129..=192 => Bitrate::Kbps192,
        193..=256 => Bitrate::Kbps256,
        _ => Bitrate::Kbps320,
    }
}

fn build_encoder(channels: u8, rate: u32, kbps: u32) -> Result<Encoder, String> {
    let mut b = Builder::new().ok_or_else(|| "LAME init failed".to_string())?;
    b.set_num_channels(channels).map_err(|e| format!("lame channels: {e:?}"))?;
    b.set_sample_rate(rate).map_err(|e| format!("lame sample rate: {e:?}"))?;
    b.set_brate(bitrate(kbps)).map_err(|e| format!("lame bitrate: {e:?}"))?;
    b.set_quality(Quality::Good).map_err(|e| format!("lame quality: {e:?}"))?;
    b.build().map_err(|e| format!("lame build: {e:?}"))
}

fn convert_inner(input: &str, output: &str, kbps: u32) -> Result<(), String> {
    let file = File::open(input).map_err(|e| format!("open input: {e}"))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = Path::new(input).extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }
    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|e| format!("unsupported or unreadable file: {e}"))?;
    let mut format = probed.format;

    let (track_id, params) = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .map(|t| (t.id, t.codec_params.clone()))
        .ok_or_else(|| "no audio track found".to_string())?;
    let mut decoder = symphonia::default::get_codecs()
        .make(&params, &DecoderOptions::default())
        .map_err(|e| format!("no decoder for this codec: {e}"))?;

    let out_file = File::create(output).map_err(|e| format!("create output: {e}"))?;
    let mut w = BufWriter::new(out_file);
    let mut encoder: Option<Encoder> = None;
    let mut out: Vec<u8> = Vec::new();

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(SymError::IoError(e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(SymError::ResetRequired) => break,
            Err(e) => return Err(format!("read error: {e}")),
        };
        if packet.track_id() != track_id {
            continue;
        }
        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(SymError::DecodeError(_)) => continue,
            Err(e) => return Err(format!("decode error: {e}")),
        };
        let spec = *decoded.spec();
        let channels = spec.channels.count();
        if channels == 0 || channels > 2 {
            return Err(format!("{channels} channels not supported"));
        }
        if encoder.is_none() {
            encoder = Some(build_encoder(channels as u8, spec.rate, kbps)?);
        }
        let enc = encoder.as_mut().unwrap();

        let mut sb = SampleBuffer::<i16>::new(decoded.capacity() as u64, spec);
        sb.copy_interleaved_ref(decoded);
        let samples = sb.samples();

        out.clear();
        out.reserve(mp3lame_encoder::max_required_buffer_size(samples.len()));
        let res = if channels == 1 {
            enc.encode(MonoPcm(samples), out.spare_capacity_mut())
        } else {
            enc.encode(InterleavedPcm(samples), out.spare_capacity_mut())
        };
        let n = res.map_err(|e| format!("encode: {e:?}"))?;
        unsafe { out.set_len(n) };
        w.write_all(&out).map_err(|e| format!("write: {e}"))?;
    }

    let enc = encoder.as_mut().ok_or_else(|| "no audio decoded".to_string())?;
    out.clear();
    out.reserve(mp3lame_encoder::max_required_buffer_size(0));
    let n = enc
        .flush::<FlushNoGap>(out.spare_capacity_mut())
        .map_err(|e| format!("flush: {e:?}"))?;
    unsafe { out.set_len(n) };
    w.write_all(&out).map_err(|e| format!("write: {e}"))?;
    w.flush().map_err(|e| format!("write: {e}"))?;
    Ok(())
}

/// Converts an audio file (m4a/aac, mp3) to mp3. On error the partial
/// output file is deleted.
pub fn convert_to_mp3(input: &str, output: &str, kbps: u32) -> Result<(), String> {
    let r = convert_inner(input, output, kbps);
    if r.is_err() {
        let _ = std::fs::remove_file(output);
    }
    r
}

#[cfg(target_os = "android")]
mod android;
