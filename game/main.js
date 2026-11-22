// Harborlight — boot, main loop, menus, screenshot scenes.
// URL scenes for screenshots: ?scene=menu | foot | chase | mission
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const state = newState();
  bindStateMethods(state);
  initGame(state);
  Input.init(canvas);
  AudioSys.init();
  let W = 1280, H = 720;
  function resize() {
    W = canvas.clientWidth || 1280; H = canvas.clientHeight || 720;
    canvas.width = W; canvas.height = H;
  }
  addEventListener('resize', resize);
  resize();
  // Scene presets (also used by the screenshot driver).
  const params = new URLSearchParams(location.search);
  state.scene = params.get('scene');
  if (state.scene === 'foot') {
    state.screen = 'play';
    state.player.x = 1500; state.player.y = 1500;
    state.objective = 'Free roam — explore Harborlight on foot.';
  } else if (state.scene === 'chase') {
    state.screen = 'play';
    const car = makeCar(0, 1500, 1500, 0);
    state.playerCar = car;
    state.wanted = 3;
    state.objective = 'Shake the tail — 3 stars!';
    for (let i = 0; i < 3; i++) {
      const cop = makeCar(6, 1500 + (i - 1) * 220, 1150, Math.PI / 2);
      cop.police = true; cop.speed = 260;
      state.police.push(cop);
    }
  } else if (state.scene === 'mission') {
    state.screen = 'play';
    startMission(state, 3);
    state.missionStarted = true;
    const car = makeCar(5, 900, 2600, 0);
    state.playerCar = car;
    state.player.x = 900; state.player.y = 2600;
  }
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state.screen === 'menu') {
      if (Input.pressed('ArrowUp') || Input.pressed('KeyW')) { state.menuSel = (state.menuSel + 2) % 3; AudioSys.click(); }
      if (Input.pressed('ArrowDown') || Input.pressed('KeyS')) { state.menuSel = (state.menuSel + 1) % 3; AudioSys.click(); }
      if (Input.pressed('Enter') || Input.clicked()) {
        AudioSys.resume(); AudioSys.click();
        if (state.menuSel === 0) { state.screen = 'play'; state.objective = 'Press T to start the first job for Marta.'; }
        else if (state.menuSel === 1) {
          if (loadGame(state)) { state.screen = 'play'; state.toast('Save loaded — welcome back, Jesse.', '#80d0ff'); }
          else { state.screen = 'play'; state.toast('No save found — starting fresh.', '#ffd060'); }
        } else { state.screen = 'play'; state.mission = -1; state.objective = 'Free roam — explore Harborlight.'; }
      }
      // Mouse hover picks the menu item.
      const my = Input.mouseY;
      if (my >= 304 && my < 350) state.menuSel = 0;
      else if (my >= 366 && my < 412) state.menuSel = 1;
      else if (my >= 428 && my < 474) state.menuSel = 2;
      drawMenu(ctx, state, W, H);
    } else if (state.screen === 'play') {
      if (Input.pressed('Escape') || Input.pressed('KeyP')) { state.screen = 'pause'; AudioSys.engineStop(); AudioSys.siren(false); }
      else {
        updateGame(state, dt);
        renderGame(ctx, state, W, H);
      }
      if (state.screen === 'pause') drawOverlay(ctx, state, W, H, 'PAUSED', ['Take a breath, Jesse.', 'The city waits.'], '#ffd060');
    } else if (state.screen === 'pause') {
      drawOverlay(ctx, state, W, H, 'PAUSED', ['Take a breath, Jesse.', 'The city waits.'], '#ffd060');
      if (Input.pressed('Escape') || Input.pressed('KeyP') || Input.pressed('Enter')) state.screen = 'play';
    } else if (state.screen === 'busted') {
      renderGame(ctx, state, W, H);
      drawOverlay(ctx, state, W, H, 'BUSTED', ['Harborlight PD hauled you in.', 'Fine: $200. The coupe is gone.'], '#ff6060');
      if (Input.pressed('Enter')) respawn(state);
    } else if (state.screen === 'wasted') {
      renderGame(ctx, state, W, H);
      drawOverlay(ctx, state, W, H, 'WASTED', ['Jesse Kane is down.', 'But Harborlight never lets go.'], '#ff6060');
      if (Input.pressed('Enter')) respawn(state);
    }
    Input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Expose for the scripted play-test.
  window.__HL__ = { state, Input };
})();
