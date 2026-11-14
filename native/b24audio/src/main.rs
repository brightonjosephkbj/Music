use std::time::Instant;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    if a.len() < 3 {
        eprintln!("usage: b24audio_cli <input> <output.mp3> [kbps]");
        std::process::exit(2);
    }
    let kbps = a.get(3).and_then(|v| v.parse().ok()).unwrap_or(192);
    let t = Instant::now();
    match b24audio::convert_to_mp3(&a[1], &a[2], kbps) {
        Ok(()) => println!("ok in {:.2}s", t.elapsed().as_secs_f32()),
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(1);
        }
    }
}
