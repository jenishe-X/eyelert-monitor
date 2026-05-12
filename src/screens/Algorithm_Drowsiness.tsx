export interface EnrollmentData {
  baselineEAR: number;
  blinkMinEAR: number;
  closedEAR: number;
  baselineMAR: number;
  yawnMAR: number;
}

export enum DrowsinessState {
  AWAKE = 'AWAKE',
  A_LITTLE_DROWSY = 'A_LITTLE_DROWSY',
  DROWSY = 'DROWSY',
  ALARM = 'ALARM'
}

export class DrowsinessAlgorithm {
  private enrollmentData: EnrollmentData | null = null;
  
  // 1. Eyes Closed (Micro-sleep) State
  private eyesClosedStartTime: number | null = null;
  
  // 2. Blink Rate State
  private blinksInCurrentMinute = 0;
  private blinkMinuteStartTime = Date.now();
  private recentBlinkRates: number[] = []; // Store past 5 minutes blink counts
  private isBlinking = false;

  // 3. Yawn State
  private yawnsInCurrentCycle = 0;
  private yawnCycleStartTime = Date.now();
  private yawnCycleHistory: number[] = []; // Store past 3-minute cycle yawn counts
  private isYawning = false;

  // 4. PERCLOS State (Smarter algorithm fallback)
  private frameHistory: boolean[] = []; 
  private readonly MAX_FRAMES = 300; // ~10-15 seconds of frames

  public setEnrollmentData(data: EnrollmentData) {
    this.enrollmentData = data;
  }

  public processFrame(ear: number, mar: number, timestamp: number = Date.now()): { state: DrowsinessState, perclos: number, yawns: number } {
    let state = DrowsinessState.AWAKE;
    let currentPerclos = 0;

    if (!this.enrollmentData) {
      return { state, perclos: currentPerclos, yawns: this.yawnsInCurrentCycle }; // Cannot process without enrollment data
    }

    const { blinkMinEAR, closedEAR, yawnMAR } = this.enrollmentData;

    // --- 1. Eyes Closed (Micro-sleep) -> ALARM ---
    // If EAR is close to or below the closed EAR (add 10% buffer to be safe, e.g. closedEAR * 1.1)
    // If closedEAR is very low (e.g. 0.05), we can use a direct threshold or a slight multiplier.
    const isClosed = ear <= Math.max(closedEAR * 1.2, 0.15); // Added fallback to 0.15 just in case closedEAR is 0
    
    if (isClosed) {
      if (!this.eyesClosedStartTime) {
        this.eyesClosedStartTime = timestamp;
      } else {
        const closedDuration = timestamp - this.eyesClosedStartTime;
        if (closedDuration >= 2000) { // 2 seconds continuous closure
          return { state: DrowsinessState.ALARM, perclos: currentPerclos, yawns: this.yawnsInCurrentCycle }; 
        }
      }
    } else {
      this.eyesClosedStartTime = null;
    }

    // --- 2. Blink Rate -> A LITTLE DROWSY ---
    // Blink detection: EAR drops below blinkMinEAR (with buffer) but isn't a prolonged closure
    const isCurrentlyBlinking = ear <= Math.max(blinkMinEAR * 1.1, 0.2) && !isClosed;
    
    if (isCurrentlyBlinking && !this.isBlinking) {
      this.isBlinking = true;
    } else if (!isCurrentlyBlinking && this.isBlinking) {
      this.isBlinking = false;
      this.blinksInCurrentMinute++;
    }

    // Check minute window for blinks (60000 ms)
    if (timestamp - this.blinkMinuteStartTime >= 60000) {
      this.recentBlinkRates.push(this.blinksInCurrentMinute);
      if (this.recentBlinkRates.length > 5) {
        this.recentBlinkRates.shift(); // Keep only last 5 minutes
      }
      this.blinksInCurrentMinute = 0;
      this.blinkMinuteStartTime = timestamp;
    }

    // Logic: if the blink is <= 5 blinks in a minute, in a straight 5 minutes -> A LITTLE DROWSY
    if (this.recentBlinkRates.length === 5) {
      const allLowBlinkRate = this.recentBlinkRates.every(rate => rate <= 5);
      if (allLowBlinkRate) {
        state = DrowsinessState.A_LITTLE_DROWSY;
      }
    }

    // --- 3. Yawn Rate -> DROWSY ---
    // Yawn detection: MAR is close to or greater than yawnMAR (e.g., 90% of yawnMAR)
    const isCurrentlyYawning = mar >= (yawnMAR * 0.9);
    
    if (isCurrentlyYawning && !this.isYawning) {
      this.isYawning = true;
    } else if (!isCurrentlyYawning && this.isYawning) {
      this.isYawning = false;
      this.yawnsInCurrentCycle++;
    }

    // Check yawn cycle window (3 minutes = 180000 ms)
    if (timestamp - this.yawnCycleStartTime >= 180000) {
      this.yawnCycleHistory.push(this.yawnsInCurrentCycle);
      if (this.yawnCycleHistory.length > 2) {
        this.yawnCycleHistory.shift(); // Keep only last 2 cycles
      }
      this.yawnsInCurrentCycle = 0;
      this.yawnCycleStartTime = timestamp;
    }

    // Logic: yawning 2-3 times in 3 minutes, repeated for a two cycle -> DROWSY
    if (this.yawnCycleHistory.length === 2) {
      const cycle1Yawns = this.yawnCycleHistory[0];
      const cycle2Yawns = this.yawnCycleHistory[1];
      if (cycle1Yawns >= 2 && cycle2Yawns >= 2) {
        state = DrowsinessState.DROWSY;
      }
    }

    // Immediate trigger: if yawning 5 or more times in the current 3-minute cycle
    if (this.yawnsInCurrentCycle >= 5) {
      state = DrowsinessState.DROWSY;
    }

    // --- 4. PERCLOS integration (Smarter algorithm fallback) ---
    // Computes percentage of eye closure over the last MAX_FRAMES
    this.frameHistory.push(isClosed);
    if (this.frameHistory.length > this.MAX_FRAMES) {
      this.frameHistory.shift();
    }
    
    if (this.frameHistory.length > 0) {
      const closedFramesCount = this.frameHistory.filter(c => c).length;
      currentPerclos = closedFramesCount / this.frameHistory.length;
      
      // Only apply PERCLOS rules if we have a decent amount of frames
      if (this.frameHistory.length >= Math.min(this.MAX_FRAMES, 50)) {
        // PERCLOS > 15% indicates drowsiness onset
        if (currentPerclos >= 0.15 && state === DrowsinessState.AWAKE) {
          state = DrowsinessState.A_LITTLE_DROWSY;
        }
        // PERCLOS > 30% indicates severe drowsiness
        if (currentPerclos >= 0.30) {
          state = DrowsinessState.DROWSY;
        }
      }
    }

    return { state, perclos: currentPerclos, yawns: this.yawnsInCurrentCycle };
  }
}
