use std::panic::{catch_unwind, AssertUnwindSafe};

use jni::objects::{JObject, JString};
use jni::sys::{jint, jstring};
use jni::JNIEnv;

// Returns "" on success, or an error message.
#[no_mangle]
pub extern "system" fn Java_expo_modules_b24media_B24Audio_nativeAudioToMp3(
    mut env: JNIEnv,
    _this: JObject,
    input: JString,
    output: JString,
    kbps: jint,
) -> jstring {
    let result = catch_unwind(AssertUnwindSafe(|| -> Result<(), String> {
        let i: String = env.get_string(&input).map_err(|e| e.to_string())?.into();
        let o: String = env.get_string(&output).map_err(|e| e.to_string())?.into();
        crate::convert_to_mp3(&i, &o, kbps.clamp(64, 320) as u32)
    }))
    .unwrap_or_else(|_| Err("native panic during conversion".to_string()));

    let msg = match result {
        Ok(()) => String::new(),
        Err(e) => e,
    };
    env.new_string(msg)
        .map(|s| s.into_raw())
        .unwrap_or(std::ptr::null_mut())
}
