//! Test notification example
//!
//! Run with: cargo run -p viben-core --example test_notification

use viben_core::notifications::{init_notifications, send_notification, set_app_bundle_id, SystemNotification};

fn main() {
    // Set bundle ID and initialize (required on macOS)
    set_app_bundle_id("com.apple.Terminal");
    init_notifications();

    println!("📢 Sending test notification via notify-rust...");
    println!("   Using app: com.apple.Terminal (Terminal.app)");

    let notification = SystemNotification::new(
        "Viben 通知测试",
        "🎉 如果你看到这条消息，说明 notify-rust 配置正确！",
    )
    .subtitle("System Notification Test");

    match send_notification(&notification) {
        Ok(()) => {
            println!("✅ Notification sent successfully!");
            println!();
            println!("如果你没有看到通知，请检查：");
            println!("1. 系统偏好设置 > 通知 > 允许通知");
            println!("2. 确保没有开启勿扰模式");
        }
        Err(e) => {
            println!("❌ Failed to send notification: {}", e);
            println!();
            println!("可能的原因：");
            println!("1. 应用未被授权发送通知");
            println!("2. Bundle ID 不正确");
            println!("3. 系统通知服务不可用");
        }
    }
}
