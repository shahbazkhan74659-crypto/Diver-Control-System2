console.log("STYLE VERSION 999");

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
};

socket.onerror = () => {
  console.log("WebSocket error");
  connectionStatus.textContent = "ERROR";
  connectionStatus.style.color = "#ff0000";
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

}

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
    console.log(gesture);
    
    if (!gesture) {
      status.textContent = "Unknown gesture";
      return;
    }
    
    status.textContent = crewMessages[gesture];
    
    if (gesture !== lastGesture) {
      lastGesture = gesture;
      holdStart = performance.now();
      return;
    }
    
    if (performance.now() - holdStart > HOLD_TIME) {
      console.log("SENDING:", gesture);
      socket.send(JSON.stringify({
        gesture: gesture,
        message: crewMessages[gesture],
        time: new Date().toISOString()
      }));
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
