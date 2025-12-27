// Small chair factory for the Unsupervised 3D game
export function makeChair(x, z, width = 0.6, depth = 0.6, height = 1.0, color = '#7b5cff', baseY = 0.02){
  const seatHeight = 0.45;
  const seat = { x, z, y: baseY + seatHeight, w: width, d: depth, h: 0.12, color };
  const back = { x: x - (width/2 - 0.02), z: z - (depth/2 - 0.02), y: baseY + seatHeight + (height - seatHeight)/2 + 0.06, w: 0.14, d: depth, h: height - seatHeight, color };
  const legSize = 0.07;
  const halfW = width/2 - legSize/2; const halfD = depth/2 - legSize/2;
  const legs = [
    { x: x-halfW, z: z-halfD, y: baseY + (seatHeight/2) - 0.04, w:legSize, d:legSize, h:seatHeight, color:'#3b2f56' },
    { x: x+halfW, z: z-halfD, y: baseY + (seatHeight/2) - 0.04, w:legSize, d:legSize, h:seatHeight, color:'#3b2f56' },
    { x: x-halfW, z: z+halfD, y: baseY + (seatHeight/2) - 0.04, w:legSize, d:legSize, h:seatHeight, color:'#3b2f56' },
    { x: x+halfW, z: z+halfD, y: baseY + (seatHeight/2) - 0.04, w:legSize, d:legSize, h:seatHeight, color:'#3b2f56' }
  ];
  // simple armrests for more character
  const armW = 0.08;
  const armrests = [
    { x: x - width/2 + armW/2, z: z, y: baseY + seatHeight + 0.04, w: armW, d: depth*0.35, h: 0.08, color: '#4b3b2f' },
    { x: x + width/2 - armW/2, z: z, y: baseY + seatHeight + 0.04, w: armW, d: depth*0.35, h: 0.08, color: '#4b3b2f' }
  ];
  return { seat, back, legs, armrests, color };
}
