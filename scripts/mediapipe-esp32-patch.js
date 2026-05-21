/**
 * Patches react-native-mediapipe for ESP32 still-frame LIVE_STREAM detection.
 */
const fs = require('fs');
const path = require('path');

const pkgRoot = path.join(__dirname, '..', 'node_modules', 'react-native-mediapipe');

const indexPath = path.join(pkgRoot, 'src', 'faceLandmarkDetection', 'index.ts');
const typesPath = path.join(pkgRoot, 'src', 'shared', 'types.ts');
const modulePath = path.join(
  pkgRoot,
  'android',
  'src',
  'main',
  'java',
  'com',
  'reactnativemediapipe',
  'facelandmarkdetection',
  'FaceLandmarkDetectionModule.kt'
);

function patchIndex() {
  if (!fs.existsSync(indexPath)) return;

  let src = fs.readFileSync(indexPath, 'utf8');

  if (!src.includes('detectLiveStreamOnImage:')) {
    src = src.replace(
      '  releaseDetector: (handle: number) => Promise<boolean>;\n  detectOnImage: (',
      '  releaseDetector: (handle: number) => Promise<boolean>;\n  detectLiveStreamOnImage: (handle: number, imagePath: string) => Promise<boolean>;\n  detectOnImage: ('
    );
  }

  if (!src.includes('detectorHandle,\n    }),')) {
    src = src.replace(
      /(\s+frameProcessor,\n)(\s+\}\),)/,
      '$1      detectorHandle,\n$2'
    );
    src = src.replace(
      /(\s+outputOrientation,\n)(\s+\]\n\s+\);)/,
      '$1      detectorHandle,\n$2'
    );
  }

  if (!src.includes('export function faceLandmarkDetectionLiveOnImage')) {
    src = src.replace(
      '\n}\n\nexport function faceLandmarkDetectionOnImage(',
      `\n}

export function faceLandmarkDetectionLiveOnImage(
  handle: number,
  imagePath: string
): Promise<boolean> {
  return getFaceLandmarkDetectionModule().detectLiveStreamOnImage(
    handle,
    imagePath
  );
}

export function faceLandmarkDetectionOnImage(`
    );
  }

  if (
    src.includes('(): MediaPipeSolution => ({') &&
    !src.includes('cameraViewLayoutChangeHandler,')
  ) {
    src = src.replace(
      /return React\.useMemo\(\s*\(\): MediaPipeSolution => \(\{\s*\n(\s*diff --git|\s*\}\);)/,
      `return React.useMemo(
    (): MediaPipeSolution => ({
      cameraViewLayoutChangeHandler,
      cameraDeviceChangeHandler: setCameraDevice,
      cameraOrientationChangedHandler: (o) => {
        outputOrientation.value = o;
      },
      resizeModeChangeHandler: () => {},
      cameraViewDimensions,
      frameProcessor,
      detectorHandle,
    }),
    [
      cameraViewDimensions,
      cameraViewLayoutChangeHandler,
      frameProcessor,
      outputOrientation,
      detectorHandle,
    ]
  );
}

export function faceLandmarkDetectionOnImage(`
    );
  }

  fs.writeFileSync(indexPath, src);
}

function patchTypes() {
  if (!fs.existsSync(typesPath)) return;

  let src = fs.readFileSync(typesPath, 'utf8');
  if (!src.includes('detectorHandle?:')) {
    src = src.replace(
      '  resizeModeChangeHandler: (resizeMode: ResizeMode) => void;\n}',
      '  resizeModeChangeHandler: (resizeMode: ResizeMode) => void;\n  detectorHandle?: number;\n}'
    );
    fs.writeFileSync(typesPath, src);
  }
}

function patchAndroidModule() {
  if (!fs.existsSync(modulePath)) return;

  let src = fs.readFileSync(modulePath, 'utf8');
  if (src.includes('detectLiveStreamOnImage')) return;

  if (!src.includes('BitmapImageBuilder')) {
    src = src.replace(
      'import com.facebook.react.modules.core.DeviceEventManagerModule\nimport com.google.mediapipe.tasks.vision.core.RunningMode',
      'import com.facebook.react.modules.core.DeviceEventManagerModule\nimport com.google.mediapipe.framework.image.BitmapImageBuilder\nimport com.google.mediapipe.tasks.vision.core.RunningMode'
    );
    src = src.replace(
      'import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker\nimport com.reactnativemediapipe.shared.loadBitmapFromPath',
      'import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker\nimport com.mrousavy.camera.core.types.Orientation\nimport com.reactnativemediapipe.shared.loadBitmapFromPath'
    );
  }

  src = src.replace(
    '  @ReactMethod\n  fun detectOnImage(\n      imagePath: String,',
    `  @ReactMethod
  fun detectLiveStreamOnImage(handle: Int, imagePath: String, promise: Promise) {
    try {
      val helper =
          FaceLandmarkDetectorMap.detectorMap[handle]
              ?: run {
                promise.reject("ENOENT", "Face landmark detector not found")
                return
              }
      val bitmap = loadBitmapFromPath(imagePath)
      val mpImage = BitmapImageBuilder(bitmap).build()
      helper.detectLiveStream(mpImage, Orientation.PORTRAIT)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject(e)
    }
  }

  @ReactMethod
  fun detectOnImage(
      imagePath: String,`
  );

  fs.writeFileSync(modulePath, src);
}

patchIndex();
patchTypes();
patchAndroidModule();
