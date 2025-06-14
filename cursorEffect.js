let lastTrailTime = 0;
const trailFrequency = .001; // Increased Hz for smoother tracing
let lastX = 0, lastY = 0, rotation = 0;

document.addEventListener("mousemove", (event) => {
    if (!document.querySelector(".profile").contains(event.target)) {
        updateCursor(event.clientX, event.clientY);
        createTrail(event.clientX, event.clientY);
    }
});

function updateCursor(x, y) {
    let dx = x - lastX;
    let dy = y - lastY;
    rotation = Math.atan2(dy, dx) * (180 / Math.PI);
    lastX = x;
    lastY = y;

    const cursor = document.querySelector(".cursor") || createCursor();
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
    cursor.style.transform = `rotate(${rotation}deg)`;
}

function createCursor() {
    const cursor = document.createElement("div");
    cursor.className = "cursor";
    cursor.innerHTML = "🚀";
    cursor.style.position = "fixed";
    cursor.style.fontSize = "72px";
    cursor.style.pointerEvents = "none";
    document.body.appendChild(cursor);
    return cursor;
}

function createTrail(x, y) {
    const trail = document.createElement("div");
    trail.className = "trail";
    trail.style.left = `${x}px`;
    trail.style.top = `${y}px`;
    trail.style.width = `${Math.random() * 30 + 20}px`;  // Random size for realistic effect
    trail.style.height = trail.style.width; 
    document.body.appendChild(trail);

    setTimeout(() => {
        trail.style.opacity = "0";
        setTimeout(() => document.body.removeChild(trail), 5000);
    }, 50);
}

