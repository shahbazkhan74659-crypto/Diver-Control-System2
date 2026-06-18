const video = document.getElementById("video");
const bioCanvas = document.getElementById("biometric_canvas");
const status = document.getElementById("status");
const handCanvas = document.getElementById("hand-canvas");
const handCtx = handCanvas.getContext("2d");

function drawHandSkeleton(landmarks) {

    handCanvas.width =
        video.videoWidth;

    handCanvas.height =
        video.videoHeight;

    handCtx.clearRect(
        0,
        0,
        handCanvas.width,
        handCanvas.height
    );

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

        const x =
            pt.x * handCanvas.width;

        const y =
            pt.y * handCanvas.height;

        handCtx.fillStyle = "#ffffff";

        handCtx.beginPath();

        handCtx.arc(
            x,
            y,
            4,
            0,
            Math.PI * 2
        );

        handCtx.fill();

        handCtx.fillStyle = "#00ff00";
        handCtx.font = "12px Arial";

        handCtx.fillText(
            i,
            x + 8,
            y - 8
        );

    });

}

const hands = new Hands({
    locateFile: (file) => {
        return `/static/vendor/mediapipe/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
});

hands.onResults((results) => {

    if (
        !results.multiHandLandmarks ||
        results.multiHandLandmarks.length === 0
    ) {

        handCtx.clearRect(
            0,
            0,
            handCanvas.width,
            handCanvas.height
        );

        return;
    }

    const landmarks =
        results.multiHandLandmarks[0];

    drawHandSkeleton(
        landmarks
    );

});

const camera = new Camera(video, {

    onFrame: async () => {

        await hands.send({
            image: video
        });

    },

    width: 640,
    height: 480

});

camera.start();


