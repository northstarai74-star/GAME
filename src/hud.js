export function updateHUD(player) {
  const speedEl = document.getElementById('speed');
  const posEl = document.getElementById('position');

  if (speedEl) {
    speedEl.textContent = `Speed: ${player.speed.toFixed(2)}`;
  }

  if (posEl) {
    posEl.textContent = `Pos: (${player.position.x.toFixed(0)}, ${player.position.y.toFixed(0)}, ${player.position.z.toFixed(0)})`;
  }
}
