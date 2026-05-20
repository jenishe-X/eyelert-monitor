/**********************************************************************
  Filename    : Camera Web Server (AP Mode - DriverMonitor)
  Description : ESP32-S3 Camera streaming via Access Point (no internet needed)
  Author      : Modified for vehicle use
**********************************************************************/

#include "esp_camera.h"
#include <WiFi.h>
#include "board_config.h"

// ===================
// Select camera model
// ===================
#define CAMERA_MODEL_ESP32S3_EYE
#include "camera_pins.h"

// ===========================
// ESP32 Access Point Credentials
// ===========================
const char* ssid = "EYELERT";
const char* password = "12345678";

void startCameraServer();

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println();

  // ===========================
  // CAMERA CONFIGURATION
  // ===========================
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000; // Increased clock frequency for better framerate
  config.pixel_format = PIXFORMAT_JPEG;

  config.frame_size = FRAMESIZE_QVGA;   // optimized for mobile streaming
  config.grab_mode = CAMERA_GRAB_LATEST; // Grab the latest frame instead of when empty to reduce lag
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 10; // Slightly better quality, lower number means higher quality
  config.fb_count = 2; // Double buffering for smoother streaming

  // PSRAM optimization
  if (psramFound()) {
    config.jpeg_quality = 10;
    config.fb_count = 2;
    config.grab_mode = CAMERA_GRAB_LATEST;
  } else {
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  // ===========================
  // INIT CAMERA
  // ===========================
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x", err);
    return;
  }

  sensor_t * s = esp_camera_sensor_get();
  s->set_vflip(s, 0);
  s->set_brightness(s, 1);
  s->set_saturation(s, 0);

  // ===========================
  // START ACCESS POINT MODE
  // ===========================
  WiFi.softAP(ssid, password);
  WiFi.setSleep(false);

  IPAddress IP = WiFi.softAPIP();

  Serial.println("");
  Serial.println("================================");
  Serial.println("ESP32 Access Point Started");
  Serial.print("SSID: ");
  Serial.println(ssid);
  Serial.print("Password: ");
  Serial.println(password);
  Serial.print("IP Address: ");
  Serial.println(IP);
  Serial.println("================================");

  // ===========================
  // START CAMERA SERVER
  // ===========================
  startCameraServer();

  Serial.println("Camera Ready!");
  Serial.println("Open in browser:");
  Serial.print("http://");
  Serial.println(IP);
}

void loop() {
  delay(10000);
}