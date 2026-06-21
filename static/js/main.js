console.log("Laptop A Liva Page Loaded");

/*======================================
   DOM Elements
======================================*/

const clock = document.getElementById("clock");
const video = document.getElementById("video");
const bioCanvas = document.getElementById('biometric_canvas');
const handCanvas = document.getElementById("hand_canvas");
const handCtx = handCanvas.getContext("2d");
const connectionStatus = document.getElementById("connection-status");
const gestureMessage = document.getElementById("gesture-message");
const gestureType = document.getElementById("gesture-type");
const messageStatus = document.getElementById("message-status");
const fps = document.getElementById("fps");

/*======================================
   FPS Calculation
======================================*/

let lastFrameTime = performance.now();
let fpsAverage = 0;

/*======================================
   Live Clock
======================================*/

function updateClock(){
    const now = new Date();
    const hours = String(
        now.getHours()
    ).padStart(2,"0");
    const minutes = String(
        now.getMinutes()
    ).padStart(2,"0");
    const seconds = String(
        now.getSeconds()
    ).padStart(2,"0");
    clock.textContent =
        `${hours}:${minutes}:${seconds}`;
}
updateClock();
setInterval(
    updateClock,
    1000
);

/*======================================
   isProducer = localhost or 127.0.0.1
======================================*/

const isProducer =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

/*======================================
   WebSocket Connection
======================================*/

const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
const socket = new WebSocket(protocol + window.location.host + "/ws/signals/");

socket.onopen = () => {
  console.log("WebSocket connected");
  connectionStatus.textContent = "CONNECTED";
  connectionStatus.style.color = "#00ff00";
};

socket.onclose = () => {
  console.log("WebSocket disconnected");
  connectionStatus.textContent = "DISCONNECTED";
  connectionStatus.style.color = "#ff4444";
  messageStatus.textContent = "FAILED";
};

socket.onerror = () => {
  console.log("WebSocket error");
  connectionStatus.textContent = "ERROR";
  connectionStatus.style.color = "#ff0000";
  messageStatus.textContent = "FAILED";
};

/*======================================
   Message Handling Variables
======================================*/

let lastGesture = null;
let holdStart = null;
const HOLD_TIME = 700;

/*======================================
   Gesture Dictionary
======================================*/
    
const crewMessages = {
  "OPEN_PALM": "START",
  "THUMBS_UP": "GOOD JOB",
  "THUMBS_DOWN": "SLOW DOWN",
  "POINT": "CHANGE DIRECTION",
  "PEACE": "NEED SUPPORT",
  "THREE": "TEAM FORMATION",
  "UNKNOWN": "ANALYZING..."
};

/*======================================
   Receiving Messages (Viewer Mode)
======================================*/

socket.onmessage = (event) => {
  console.log("Message arrived:", event.data);
  console.log("FROM SERVER:", event.data);

  const data = JSON.parse(event.data);

  // Viewer mode (Laptop B)
  if (!isProducer) {
    messageStatus.textContent = data.message;
    console.log("Producer mode active");
  }
};

/*======================================
   Hand Skeleton Tracking
======================================*/

function drawHandSkeleton(landmarks) {
  handCanvas.width = video.videoWidth;
  handCanvas.height = video.videoHeight;
  handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);

  const CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],
    [0,17]
  ];

  handCtx.strokeStyle = "#00f0ff";
  handCtx.lineWidth = 2;
  handCtx.shadowBlur = 10;
  handCtx.shadowColor = "#00f0ff";

  CONNECTIONS.forEach(([a,b]) => {
    handCtx.beginPath();
    handCtx.moveTo(
      landmarks[a].x * handCanvas.width,
      landmarks[a].y * handCanvas.height
    );
    handCtx.lineTo(
      landmarks[b].x * handCanvas.width,
      landmarks[b].y * handCanvas.height
    );
    handCtx.stroke();
  });

  landmarks.forEach((pt,i) => {
    const x = pt.x * handCanvas.width;
    const y = pt.y * handCanvas.height;

    if ([4,8,12,16,20].includes(i)) {
      handCtx.strokeRect(x-6,y-6,12,12);
    } else {
      handCtx.fillStyle = "#ffffff";
      handCtx.fillRect(x-2,y-2,4,4);

      handCtx.fillStyle = "#00ff00";
      handCtx.font = "14px Arial";
      handCtx.fillText(i, x + 8, y - 8);
    }
  });
}

/*======================================
   Gesture Classification
======================================*/

function classifyGesture(lm) {
  if (!lm || lm.length < 21) return null;

  const thumb = lm[4];
  const index = lm[8];
  const middle = lm[12];
  const ring = lm[16];
  const pinky = lm[20];

  const indexUp = index.y < lm[6].y;
  const middleUp = middle.y < lm[10].y;
  const ringUp = ring.y < lm[14].y;
  const pinkyUp = pinky.y < lm[18].y;

  const thumbUp = thumb.y < lm[3].y;
  const thumbDown = thumb.y > lm[3].y;

  const allUp = indexUp && middleUp && ringUp && pinkyUp;
  const noneUp = !indexUp && !middleUp && !ringUp && !pinkyUp;

  // 👍 THUMBS UP
  if (thumbUp && noneUp) {
    return "THUMBS_UP";
  }

  // 👎 THUMBS DOWN
  if (thumbDown && noneUp) {
    return "THUMBS_DOWN";
  }

  // ✋ OPEN PALM
  if (allUp) {
    return "OPEN_PALM";
  }

  // ☝ POINT
  if (indexUp && !middleUp && !ringUp && !pinkyUp) {
    return "POINT";
  }

  // ✌ PEACE
  if (indexUp && middleUp && !ringUp && !pinkyUp) {
    return "PEACE";
  }

  // 3️⃣ THREE
  if (indexUp && middleUp && ringUp && !pinkyUp) {
    return "THREE";
  }

  return "UNKNOWN";
}

/*======================================
   Producer Mode: Send Data to Server
======================================*/

if (isProducer) {

  const hands = new Hands({
    locateFile: (file) =>
      `/static/vendor/mediapipe/${file}`,
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.8,
    minTrackingConfidence: 0.8
  });

  hands.onResults((results) => {
    const now = performance.now();
    const instantFPS = 1000 / (now - lastFrameTime);
    lastFrameTime = now;
    fpsAverage =
    fpsAverage * 0.9 + instantFPS * 0.1;
    fps.textContent = `FPS: ${Math.round(fpsAverage)}`;
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      console.log("onResults fired");
      gestureMessage.textContent = "No hand detected";
      handCtx.clearRect(0,0,handCanvas.width,handCanvas.height);
      lastGesture = null;
      holdStart = null;
      return;
    }
    
    const landmarks = results.multiHandLandmarks[0]; 
    drawHandSkeleton(landmarks);
    const gesture = classifyGesture(landmarks);
    gestureType.textContent = gesture || "UNKNOWN";
    console.log(gesture);
    
    if (!gesture) {
      gestureMessage.textContent = "Unknown gesture";
      return;
    }
    
    gestureMessage.textContent = crewMessages[gesture];

    if (gesture !== lastGesture) {
      lastGesture = gesture;
      holdStart = performance.now();
      messageStatus.textContent = "SENDING...";
      return;
    }
    
    if (performance.now() - holdStart > HOLD_TIME) {
      console.log("SENDING:", gesture);
      socket.send(JSON.stringify({
        gesture: gesture,
        message: crewMessages[gesture],
        time: new Date().toISOString()
      }));
      messageStatus.textContent = "SENT";
      lastGesture = null;
      holdStart = null;
    }
  });

  const camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 640,
    height: 480,
  });

  camera.start();
}
