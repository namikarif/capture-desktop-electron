// const apiUrl = "https://nestjs-socket.onrender.com";
const apiUrl = "http://localhost:3001";

const socket = io(apiUrl);

let peerConnection = null;
let screenStream = null;
let cameraStream = null;
let recorder = null;
let deviceState = {
    id: '',
    status: false,
    isEnable: false,
    isLock: false,
}

window.electron.onPowerEvent((event) => {
    if (event === "shutdown") {
        stopCapture();
        deviceState.status = false;

        socket.emit("change-state", deviceState);
    } else if (event === "lock") {
        stopCapture();
        deviceState.isEnable = false;
        deviceState.isLock = true;

        socket.emit("change-state", deviceState);
    } else if (event === "resume" || event === "unlock") {
        deviceState.status = true;
        deviceState.isEnable = true;
        deviceState.isLock = false;

        socket.emit("change-state", deviceState);
    }
});

const setComputer = async () => {
    const id = await window.electron.getUniqueId();

    socket.on(`start-stream-${id}`, startCapture);
    socket.on(`stop-stream-${id}`, stopCapture);

    socket.emit("register-computer", {id});
    deviceState = {
        id,
        status: true,
        isEnable: true,
        isLock: false,
    }
    socket.emit("change-state", deviceState);
}

const stopCapture = () => {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }

    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    if (peerConnection) {
        peerConnection.onicecandidate = null;
        peerConnection.ontrack = null;
        peerConnection.oniceconnectionstatechange = null;
        peerConnection.onnegotiationneeded = null;

        peerConnection.getSenders().forEach(sender => peerConnection.removeTrack(sender));

        if (peerConnection.signalingState !== "closed") {
            peerConnection.close();
        }

        peerConnection = null;
    }

    recorder?.stop();

    socket.emit("change-state", {...deviceState, isEnable: true});

    socket.off("ice-candidate");
    socket.off("answer");

    console.log("🛑 Capture fully stopped!");
};

const startCapture = async () => {
    stopCapture();

    await new Promise(resolve => setTimeout(resolve, 500));

    peerConnection = new RTCPeerConnection();

    const sources = await window.electron.getDesktopSources({types: ["screen", "window"]});

    const screenConstraints = {
        video: {
            mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: sources[0].id,
            },
        },
    };

    screenStream = await navigator.mediaDevices.getUserMedia(screenConstraints);
    cameraStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});

    recorder = new MediaRecorder(cameraStream, {mimeType: 'video/webm'});

    recorder.ondataavailable = (event) => {
        socket.emit("stream-blob-data", {
            blob: event.data,
            id: `${deviceState.id}-cameraStream-${new Date().getTime()}`
        });
    };

    recorder.onstop = () => {
        console.log("Video recording stopped");
    };

    recorder.start(100);

    peerConnection.getSenders().forEach(sender => peerConnection.removeTrack(sender));

    screenStream.getTracks().forEach(track => peerConnection.addTrack(track, screenStream));
    cameraStream.getTracks().forEach(track => peerConnection.addTrack(track, cameraStream));

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("offer", offer);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("ice-candidate", event.candidate);
        }
    };

    socket.on("ice-candidate", async (candidate) => {
        if (peerConnection && peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });

    socket.on("answer", async (answer) => {
        if (!peerConnection || peerConnection.signalingState !== "have-local-offer") {
            console.warn("⚠️ Unexpected answer, ignoring.");
            return;
        }
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

        socket.emit("change-state", {...deviceState, isEnable: false});
    });

    console.log("🎥 Capture started!");
};

setComputer();
