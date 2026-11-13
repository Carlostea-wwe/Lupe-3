/* Verbindet Kamera, Darstellung und die untere Tastenleiste. */
(function (SBL) {
  "use strict";

  var TEXT = {
    insecure: "Die Kamera funktioniert nur über eine gesicherte Verbindung (https oder localhost). Unten sehen Sie eine Beispielansicht.",
    denied: "Der Kamerazugriff wurde abgelehnt. Erlauben Sie die Kamera für diese Seite in den Browser-Einstellungen und tippen Sie dann auf „Erneut versuchen“. Bis dahin sehen Sie eine Beispielansicht.",
    missing: "Es wurde keine Kamera gefunden. Sie sehen eine Beispielansicht, damit Sie die Tasten ausprobieren können.",
    busy: "Die Kamera wird gerade von einer anderen App benutzt. Schließen Sie diese und tippen Sie auf „Erneut versuchen“.",
    unknown: "Die Kamera konnte nicht gestartet werden. Sie sehen eine Beispielansicht.",
    starting: "Kamera wird gestartet …",
    beispiel: "Beispielansicht. Tippen Sie auf „Kamera starten“, wenn Sie das echte Kamerabild wollen.",
    torchFail: "Die Taschenlampe konnte nicht geschaltet werden.",
    switchFail: "Kamera konnte nicht gewechselt werden",
    rear: "Rückkamera aktiv.",
    front: "Frontkamera aktiv.",
    zoomMax: "Größte Vergrößerung erreicht.",
    zoomMin: "Kleinste Vergrößerung erreicht."
  };

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (err) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (err) { /* privatmodus */ }
  }

  function announce(text) {
    var live = document.getElementById("live");
    if (!live) return;
    live.textContent = "";
    window.setTimeout(function () { live.textContent = text; }, 40);
  }

  var INSTALL_SEEN = "sblupe-install-seen";
  var installPromptEvent = null;

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    installPromptEvent = event;
    if (SBL.app && SBL.app.refreshInstall) SBL.app.refreshInstall();
  });
  window.addEventListener("appinstalled", function () {
    installPromptEvent = null;
    if (SBL.app && SBL.app.refreshInstall) SBL.app.refreshInstall();
  });

  function thisPlatform() {
    var touch = 0;
    try { touch = navigator.maxTouchPoints || 0; } catch (err) { touch = 0; }
    return SBL.devicePlatform(navigator.userAgent || "", touch, navigator.platform || "");
  }

  function appIsInstalled() {
    try {
      if (window.matchMedia("(display-mode: standalone)").matches) return true;
    } catch (err) { /* ohne matchMedia */ }
    return navigator.standalone === true;
  }

  function displayModeName() {
    return appIsInstalled() ? "standalone" : "browser";
  }

  function formatEnd(value) {
    var rounded = Math.round(value * 10) / 10;
    if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
      return String(Math.round(rounded)) + "x";
    }
    return rounded.toFixed(1).replace(".", ",") + "x";
  }

  function init() {
    var video = document.getElementById("video");
    var canvas = document.getElementById("view");
    var view = document.getElementById("view-wrap");
    var bar = document.getElementById("bar");
    var scroller = document.getElementById("bar-scroll");
    var overlay = document.getElementById("zoom-overlay");
    var modeHint = document.getElementById("mode-hint");
    var slider = document.getElementById("zoom-slider");
    var zoomMinLabel = document.getElementById("zoom-min");
    var zoomMaxLabel = document.getElementById("zoom-max");
    var banner = document.getElementById("banner");
    var bannerText = document.getElementById("banner-text");
    var retry = document.getElementById("retry");

    var settings = SBL.loadSettings();
    var camera = new SBL.Camera(video);

    var renderer = SBL.createRenderer(document.getElementById("view"));
    canvas = document.getElementById("view");
    var demo = SBL.createDemoSource();
    var usingDemo = true;
    var frozen = false;
    var snapshot = null;
    var freezeBaseScale = 1;
    var freezeBaseZoom = 1;
    var mode = settings.remember ? SBL.modeById(storageGet("sblupe-mode")) : SBL.modeById("normal");
    if (!settings.modes[mode.id]) mode = SBL.modeById("normal");
    if (settings.remember) {
      var savedZoom = parseFloat(storageGet("sblupe-zoom"));
      if (isFinite(savedZoom)) camera.setZoom(savedZoom);
    }
    var overlayTimer = 0;
    var hintTimer = 0;
    var flashTimer = 0;
    var zoomAnnounceTimer = 0;
    var lastPinch = 0;
    var slowTimer = 0;

    renderer.setMode(mode);
    renderer.setMagnification(1);
    renderer.setSource(null);
    renderer.start();

    var torchButton = controlButton("torch", "Licht", "Taschenlampe ein oder aus");
    torchButton.setAttribute("aria-pressed", "false");
    torchButton.hidden = true;
    var modeButton = controlButton("mode", mode.label, "Darstellung " + mode.label + ". Tippen für die nächste.");
    modeButton.classList.add("mode-btn");
    var house = document.createElement("span");
    house.className = "house";
    house.setAttribute("aria-hidden", "true");
    house.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3.2 3 11h2.2v9.2h5.1v-5.6h3.4v5.6H19V11h2.2L12 3.2z"/></svg>';
    modeButton.insertBefore(house, modeButton.firstChild);

    var freezeButton = controlButton("freeze", "Bild einfrieren", "Bild einfrieren");
    freezeButton.setAttribute("aria-pressed", "false");
    var modeCluster = cluster("group", "Darstellung");
    modeCluster.appendChild(modeButton);
    modeCluster.appendChild(freezeButton);
    var settingsButton = controlButton("settings", "Einstellungen", "Einstellungen öffnen");
    var gear = document.createElement("span");
    gear.className = "gear";
    gear.setAttribute("aria-hidden", "true");
    gear.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.4 13.5a7.7 7.7 0 0 0 .1-1.5 7.7 7.7 0 0 0-.1-1.5l2-1.6a.7.7 0 0 0 .2-.9l-1.9-3.3a.7.7 0 0 0-.9-.3l-2.4 1a7.4 7.4 0 0 0-2.6-1.5l-.4-2.5A.7.7 0 0 0 12.7 1h-3.8a.7.7 0 0 0-.7.6l-.4 2.5a7.4 7.4 0 0 0-2.6 1.5l-2.4-1a.7.7 0 0 0-.9.3L.1 8a.7.7 0 0 0 .2.9l2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6a.7.7 0 0 0-.2.9l1.9 3.3a.7.7 0 0 0 .9.3l2.4-1a7.4 7.4 0 0 0 2.6 1.5l.4 2.5a.7.7 0 0 0 .7.6h3.8a.7.7 0 0 0 .7-.6l.4-2.5a7.4 7.4 0 0 0 2.6-1.5l2.4 1a.7.7 0 0 0 .9-.3l1.9-3.3a.7.7 0 0 0-.2-.9l-2-1.6zM10.8 15.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4z"/></svg>';
    settingsButton.insertBefore(gear, settingsButton.firstChild);
    var toolCluster = cluster("group", "Werkzeuge");
    toolCluster.appendChild(torchButton);
    toolCluster.appendChild(settingsButton);
    scroller.appendChild(modeCluster);
    scroller.appendChild(toolCluster);

    function controlButton(action, label, aria) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "ctrl";
      button.setAttribute("data-action", action);
      button.setAttribute("aria-label", aria);
      var word = document.createElement("span");
      word.className = "ctrl-label";
      word.textContent = label;
      button.appendChild(word);
      return button;
    }

    function cluster(role, label) {
      var node = document.createElement("div");
      node.className = "cluster";
      node.setAttribute("role", role);
      node.setAttribute("aria-label", label);
      return node;
    }

    function updateFades() {
      var max = scroller.scrollWidth - scroller.clientWidth;
      bar.classList.toggle("overflowing", max > 8);
      bar.classList.toggle("can-left", scroller.scrollLeft > 8);
      bar.classList.toggle("can-right", max - scroller.scrollLeft > 8);
    }

    function describeImage() {
      var prefix = usingDemo ? "Beispielansicht" : "Kamerabild";
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", prefix + ", Darstellung " + mode.label);
    }

    var focusRing = document.getElementById("focus-ring");
    var focusRingTimer = 0;

    function focusAtPoint(clientX, clientY) {
      if (!settings.tapFocus || frozen || usingDemo) return;
      if (!camera.focusCapabilities().supported) return;
      var rect = view.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var nx = (clientX - rect.left) / rect.width;
      var ny = (clientY - rect.top) / rect.height;
      if (nx < 0 || ny < 0 || nx > 1 || ny > 1) return;
      var point = renderer.viewToSource(nx, ny);
      focusRing.style.left = (clientX - rect.left) + "px";
      focusRing.style.top = (clientY - rect.top) + "px";
      focusRing.classList.remove("show");
      void focusRing.offsetWidth;
      focusRing.classList.add("show");
      window.clearTimeout(focusRingTimer);
      focusRingTimer = window.setTimeout(function () {
        focusRing.classList.remove("show");
      }, 900);
      camera.focusAt(point.x, point.y).then(function (ok) {
        if (!ok) {
          focusRing.classList.remove("show");
          return;
        }
        showModeHint("Scharfgestellt");
        announce("Scharfgestellt.");
      }).catch(function () {
        focusRing.classList.remove("show");
      });
    }

    function showModeHint(text, duration) {
      modeHint.textContent = text;
      modeHint.classList.add("show");
      window.clearTimeout(hintTimer);
      hintTimer = window.setTimeout(function () {
        modeHint.classList.remove("show");
      }, duration || 1000);
    }

    var orientToken = 0;
    var rotateHinted = false;
    var orientStatus = "–";

    function isLandscape() {
      try {
        if (window.matchMedia("(orientation: landscape)").matches) return true;
        if (window.matchMedia("(min-aspect-ratio: 4/3)").matches) return true;
      } catch (err) { /* ohne matchMedia */ }
      try {
        var type = screen.orientation && screen.orientation.type;
        if (type) return type.indexOf("landscape") === 0;
      } catch (err2) { /* ältere Browser */ }
      return false;
    }

    function considerRotateHint(wantsLock, locked) {
      var landscape = isLandscape();
      if (!landscape) {
        rotateHinted = false;
        return;
      }
      var show = SBL.rotateHintNeeded({
        wantsLock: wantsLock,
        landscape: true,
        locked: locked,
        alreadyHinted: rotateHinted
      });
      if (!show) return;
      rotateHinted = true;
      var hint = SBL.rotateLockHint(thisPlatform());
      showModeHint(hint, 1800);
      announce(hint + ".");
    }

    function applyOrientation() {
      var token = orientToken + 1;
      orientToken = token;
      var wantsLock = false;
      try { wantsLock = SBL.wantsPortraitLock(settings.rotate, settings.readingGuide); } catch (err) { wantsLock = false; }
      var orientation = null;
      try { orientation = screen.orientation || null; } catch (err) { orientation = null; }
      function finish(locked, err) {
        if (token !== orientToken) return;
        if (locked) orientStatus = "locked";
        else if (err && (err.name || err.message)) orientStatus = err.name || String(err.message);
        else if (!wantsLock) orientStatus = "unlocked";
        else orientStatus = "unsupported";
        considerRotateHint(wantsLock, locked);
        updateDebug();
      }
      try {
        if (wantsLock && orientation && typeof orientation.lock === "function") {
          Promise.resolve(orientation.lock("portrait")).then(function () {
            finish(true);
          }).catch(function (err) {
            finish(false, err);
          });
          return;
        }
        if (!wantsLock && orientation && typeof orientation.unlock === "function") {
          Promise.resolve(orientation.unlock()).catch(function () {});
        }
      } catch (err) {
        finish(false, err);
        return;
      }
      finish(false);
    }

    function selectMode(next, fromUser) {
      if (!next) next = SBL.MODES[0];
      mode = next;
      renderer.setMode(mode);
      if (settings.remember) storageSet("sblupe-mode", mode.id);
      modeButton.querySelector(".ctrl-label").textContent = mode.label;
      var isNormal = mode.id === "normal";
      modeButton.classList.toggle("is-normal", isNormal);
      modeButton.setAttribute("aria-pressed", isNormal ? "false" : "true");
      modeButton.setAttribute("aria-label", "Darstellung " + mode.label + ". Tippen für die nächste.");
      describeImage();
      if (fromUser) {
        showModeHint(mode.label);
        announce("Darstellung " + mode.label);
        if (isNormal) markNormal();
      }
    }

    function markNormal() {
      view.classList.remove("normal-flash");
      void view.offsetWidth;
      view.classList.add("normal-flash");
      window.clearTimeout(flashTimer);
      flashTimer = window.setTimeout(function () {
        view.classList.remove("normal-flash");
      }, 1350);
      try {
        if (typeof navigator.vibrate === "function") {
          navigator.vibrate([45, 55, 45]);
        }
      } catch (err) { /* z. B. ältere Browser */ }
    }

    function cycleMode() {
      var list = SBL.enabledModes(settings);
      var index = 0;
      var i;
      for (i = 0; i < list.length; i += 1) {
        if (list[i].id === mode.id) index = i;
      }
      selectMode(list[(index + 1) % list.length], true);
    }

    var seenZoom = null;

    function renderZoom(state) {
      if (seenZoom !== null && state.zoom !== seenZoom && renderer.resetSmooth) renderer.resetSmooth();
      seenZoom = state.zoom;
      var label = SBL.formatZoom(state.zoom);
      slider.min = state.zoomMin;
      slider.max = state.zoomMax;
      if (String(slider.value) !== String(state.zoom)) slider.value = state.zoom;
      zoomMinLabel.textContent = formatEnd(state.zoomMin);
      zoomMaxLabel.textContent = formatEnd(state.zoomMax);
      slider.setAttribute("aria-valuetext", label + " Zoom");
      overlay.textContent = label;
      var magnification = state.digitalScale;
      if (frozen) {
        magnification = freezeBaseScale * (state.zoom / Math.max(freezeBaseZoom, 0.01));
        if (magnification < 1) magnification = 1;
      }
      renderer.setMagnification(magnification);
      if (settings.remember) storageSet("sblupe-zoom", String(state.zoom));
    }

    function applyAdjust() {
      var filter = "";
      if (settings.brightness !== 100 || settings.contrast !== 100) {
        filter = "brightness(" + settings.brightness + "%) contrast(" + settings.contrast + "%)";
      }
      canvas.style.filter = filter;
    }

    var safeProbe = null;

    function safeTopPx() {
      if (!safeProbe) {
        safeProbe = document.createElement("div");
        safeProbe.setAttribute("aria-hidden", "true");
        safeProbe.style.cssText = "position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top);visibility:hidden;pointer-events:none;";
        document.body.appendChild(safeProbe);
      }
      return safeProbe.getBoundingClientRect().height || 0;
    }

    function applyGuide() {
      var guide = document.getElementById("reading-guide");
      var win = guide.querySelector(".guide-window");
      var shadeTop = guide.querySelector(".guide-shade-top");
      var shadeBottom = guide.querySelector(".guide-shade-bottom");
      var handle = document.getElementById("guide-handle");
      var grip = document.getElementById("guide-grip");
      var height = SBL.guideFraction(settings.guideSize);
      guide.hidden = !settings.readingGuide;
      guide.classList.remove("size-klein", "size-mittel", "size-gross");
      guide.classList.add("size-" + settings.guideSize);
      var viewRect = view.getBoundingClientRect();
      var viewH = viewRect.height || 1;
      var dock = document.querySelector(".dock");
      var dockTop = dock ? dock.getBoundingClientRect().top : viewRect.bottom;
      var freeTopPx = Math.max(0, safeTopPx() - viewRect.top);
      var freeBottomPx = dockTop - viewRect.top;
      if (freeBottomPx > viewH) freeBottomPx = viewH;
      if (freeBottomPx < freeTopPx) freeBottomPx = viewH;
      var handleH = guide.hidden ? 0 : (handle.offsetHeight || 0);
      var previous = settings.guideOffset;
      settings.guideOffset = SBL.clampGuideInView(
        previous,
        height,
        freeTopPx / viewH,
        freeBottomPx / viewH,
        handleH / viewH
      );
      if (settings.remember && !guideDrag && Math.abs(previous - settings.guideOffset) > 0.0005) {
        persistGuide();
      }
      var top = settings.guideOffset - height / 2;
      win.style.top = (top * 100) + "%";
      win.style.height = (height * 100) + "%";
      shadeTop.style.top = "0";
      shadeTop.style.height = Math.max(0, top * 100) + "%";
      shadeBottom.style.top = ((top + height) * 100) + "%";
      shadeBottom.style.height = Math.max(0, (1 - top - height) * 100) + "%";
      handle.style.top = (settings.guideOffset * 100) + "%";
      if (grip) grip.setAttribute("aria-valuenow", String(Math.round(settings.guideOffset * 100)));
    }

    function persistGuide() {
      if (settings.remember) SBL.saveSettings(settings);
    }

    function updateTorch(state) {
      torchButton.hidden = !state.torchSupported;
      torchButton.setAttribute("aria-pressed", state.torch ? "true" : "false");
      torchButton.querySelector(".ctrl-label").textContent = state.torch ? "Licht an" : "Licht";
      torchButton.setAttribute("aria-label", state.torch ? "Taschenlampe ausschalten" : "Taschenlampe einschalten");
    }

    function showOverlay() {
      overlay.classList.add("show");
      window.clearTimeout(overlayTimer);
      overlayTimer = window.setTimeout(function () {
        overlay.classList.remove("show");
      }, 900);
    }

    function zoomSentence(state) {
      return "Vergrößerung " + SBL.formatZoom(state.zoom).replace("×", " mal");
    }

    function scheduleZoomAnnounce() {
      window.clearTimeout(zoomAnnounceTimer);
      zoomAnnounceTimer = window.setTimeout(announceZoom, 280);
    }

    function announceZoom() {
      var state = camera.getState();
      var text = zoomSentence(state);
      if (state.zoom >= state.zoomMax - 0.02) text += " Größte Stufe.";
      else if (state.zoom <= state.zoomMin + 0.02) text += " Kleinste Stufe.";
      announce(text);
    }

    function showBanner(text, buttonLabel) {
      bannerText.textContent = text;
      retry.hidden = !buttonLabel;
      if (buttonLabel) retry.textContent = buttonLabel;
      banner.hidden = false;
      announce(text);
    }

    function hideBanner() {
      banner.hidden = true;
      bannerText.textContent = "";
    }

    function useDemo(code) {
      usingDemo = true;
      if (!frozen) renderer.setSource(demo);
      describeImage();
      var key = TEXT[code] ? code : "unknown";
      var buttonLabel = code === "beispiel" ? "Kamera starten" : "Erneut versuchen";
      if (code === "insecure") buttonLabel = "";
      showBanner(TEXT[key], buttonLabel);
    }

    function liveSource() {
      return usingDemo ? demo : video;
    }

    function setFreezeButton(on) {
      freezeButton.setAttribute("aria-pressed", on ? "true" : "false");
      freezeButton.setAttribute("aria-label", on ? "Bild ist eingefroren. Tippen für das Livebild." : "Bild einfrieren");
    }

    function toggleFreeze() {
      if (frozen) {
        frozen = false;
        snapshot = null;
        if (renderer.holdSmooth) renderer.holdSmooth(false);
        if (renderer.releaseFreeze) renderer.releaseFreeze();
        renderer.setPan(0, 0);
        camera.setFreezeZoom(false);
        renderer.setSource(liveSource());
        setFreezeButton(false);
        showModeHint("Livebild");
        announce("Livebild.");
        return;
      }
      var src = liveSource();
      var size = SBL.sourceSize(src);
      if (!size) {
        showModeHint("Kein Bild zum Einfrieren");
        announce("Kein Bild zum Einfrieren.");
        return;
      }
      freezeBaseScale = camera.getState().digitalScale || 1;
      freezeBaseZoom = camera.getState().zoom || 1;
      frozen = true;
      if (renderer.holdSmooth && (mode.kind === SBL.KIND.smooth || mode.kind === SBL.KIND.smooth2 || mode.kind === SBL.KIND.smooth3 || mode.kind === SBL.KIND.smooth4 || mode.kind === SBL.KIND.smoothBw || mode.kind === SBL.KIND.smoothYb || mode.kind === SBL.KIND.smoothAmber || mode.kind === SBL.KIND.smoothGray)) renderer.holdSmooth(true);
      renderer.setPan(0, 0);
      camera.setFreezeZoom(true);
      if (renderer.captureFreeze && renderer.captureFreeze(size[0], size[1])) {
        snapshot = null;
        renderer.setSource({ width: size[0], height: size[1] });
      } else {
        snapshot = document.createElement("canvas");
        snapshot.width = size[0];
        snapshot.height = size[1];
        var copy = snapshot.getContext("2d");
        copy.imageSmoothingEnabled = false;
        copy.drawImage(src, 0, 0, size[0], size[1]);
        renderer.setSource(snapshot);
      }
      setFreezeButton(true);
      showModeHint("Bild eingefroren");
      announce("Bild eingefroren. Vergrößern Sie es und schieben Sie es mit dem Finger.");
    }

    function useCamera() {
      usingDemo = false;
      if (!frozen) renderer.setSource(video);
      hideBanner();
      describeImage();
    }

    function boot() {
      window.clearTimeout(slowTimer);
      slowTimer = window.setTimeout(function () {
        if (!camera.getState().active && banner.hidden) showBanner(TEXT.starting, "");
      }, 600);
      return camera.start().then(function () {
        window.clearTimeout(slowTimer);
        useCamera();
        announce(camera.getState().facing === "user" ? TEXT.front : TEXT.rear);
      }).catch(function (err) {
        window.clearTimeout(slowTimer);
        useDemo(err && err.code);
      });
    }

    var pageZoomLabel = "–";

    function applyUiScale() {
      var touch = 0;
      try { touch = navigator.maxTouchPoints || 0; } catch (err) { touch = 0; }
      var platform = SBL.devicePlatform(navigator.userAgent || "", touch, navigator.platform || "");
      var vv = window.visualViewport;
      var info = SBL.pageZoomInfo({
        ios: platform === "ios",
        androidChrome: platform === "android" || platform === "android-chrome" || platform === "samsung",
        innerWidth: window.innerWidth,
        screenWidth: window.screen ? screen.width : 0,
        vvWidth: vv && vv.width ? vv.width : window.innerWidth,
        vvScale: vv && typeof vv.scale === "number" ? vv.scale : 1
      });
      var zoom = info.reliable && info.factor > 1.05 ? info.factor : 1;
      pageZoomLabel = info.reliable ? info.factor.toFixed(2) : "–";
      document.documentElement.style.setProperty("--ui-scale", String(SBL.textScale(settings.textSize)));
      document.documentElement.style.setProperty("--page-zoom", String(zoom));
    }

    var debugOn = /(?:\?|&)debug=1(?:&|$)/.test(location.search);
    var debugEl = document.getElementById("cam-debug");

    function updateDebug() {
      if (!debugOn || !debugEl) return;
      debugEl.hidden = false;
      var state = camera.getState();
      camera.listCameras().then(function (cameras) {
        var reported = camera.reportedFacing || "";
        var id = camera.deviceId || "";
        debugEl.textContent = (camera.desiredFacing || camera.facing || "?")
          + " · " + (reported || "–")
          + " · " + (id ? id.slice(0, 6) : "–")
          + " · " + cameras.length
          + " · " + (camera.lastError || "–")
          + " · " + displayModeName()
          + " · " + (orientStatus || "–")
          + " · zoom " + pageZoomLabel
          + " · " + (camera.frameWidth || "–") + "×" + (camera.frameHeight || "–")
          + " hw" + (typeof camera.hardwareZoom === "number" ? camera.hardwareZoom.toFixed(2) : "–")
          + " opt" + (state.opticalMax ? state.opticalMax.toFixed(2) : "–")
          + " dig" + (state.digitalScale ? state.digitalScale.toFixed(2) : "1")
          + " · " + (renderer.frameMs ? renderer.frameMs().toFixed(1) : "–") + " ms";
      }).catch(function () {});
    }

    camera.onChange(function (state) {
      renderZoom(state);
      updateTorch(state);
      refreshFocusSwitch();
      updateDebug();
      window.requestAnimationFrame(updateFades);
    });

    renderZoom(camera.getState());
    selectMode(mode, false);
    describeImage();

    slider.addEventListener("input", function () {
      camera.setZoom(parseFloat(slider.value));
      showOverlay();
    });
    slider.addEventListener("change", announceZoom);
    slider.addEventListener("pointerup", showOverlay);
    slider.addEventListener("touchend", showOverlay);
    modeButton.addEventListener("click", cycleMode);
    freezeButton.addEventListener("click", toggleFreeze);

    torchButton.addEventListener("click", function () {
      camera.toggleTorch().then(function (on) {
        var text = on ? "Licht an" : "Licht aus";
        showModeHint(text);
        announce(text + ".");
      }).catch(function () {
        showModeHint(TEXT.torchFail);
        announce(TEXT.torchFail);
      });
    });

    function refreshCameraChoices() {
      camera.listCameras().then(function (cameras) {
        var button = document.getElementById("set-switch");
        var note = document.getElementById("camera-note");
        if (!button || !note) return;
        var labeled = cameras.filter(function (item) { return item.label; });
        var single = labeled.length === 1 && cameras.length === 1;
        button.disabled = single;
        note.hidden = !single;
      }).catch(function () {});
    }

    function waitForMenuClosed() {
      return new Promise(function (resolve) {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            setTimeout(resolve, 220);
          });
        });
      });
    }

    var menuSwitching = false;

    function switchCamera() {
      if (menuSwitching || camera.switching) return;
      var button = document.getElementById("set-switch");
      if (!button || button.disabled) return;
      menuSwitching = true;
      button.disabled = true;
      closeSettings();
      waitForMenuClosed().then(function () {
        return camera.switchFacing();
      }).then(function (result) {
        if (result && result.ignored) return;
        useCamera();
        return camera.playVideo().then(function () {
          var cameraText = camera.facing === "user" ? "Frontkamera" : "Rückkamera";
          showModeHint(cameraText);
          announce(cameraText + ".");
          updateDebug();
        });
      }).catch(function (err) {
        showModeHint(TEXT.switchFail);
        announce(TEXT.switchFail + ".");
        updateDebug();
        if (!camera.getState().active) useDemo(err && err.code);
        else if (!frozen) renderer.setSource(video);
      }).then(function () {
        menuSwitching = false;
        refreshCameraChoices();
        updateFades();
      });
    }

    retry.addEventListener("click", function () {
      showBanner(TEXT.starting, "");
      boot();
    });

    function touchOnGuide(event) {
      var i;
      var touches = event.touches || [];
      for (i = 0; i < touches.length; i += 1) {
        var target = touches[i].target;
        if (target && target.closest && target.closest(".guide-handle")) return true;
      }
      return !!(event.target && event.target.closest && event.target.closest(".guide-handle"));
    }

    var drag = null;
    var tap = null;
    var guideDrag = null;
    view.addEventListener("touchstart", function (event) {
      if (guideDrag || touchOnGuide(event)) return;
      if (event.touches.length === 2) {
        drag = null;
        tap = null;
        lastPinch = Date.now();
        view._pinch = {
          dist: touchDistance(event.touches),
          zoom: camera.getState().zoom
        };
      } else if (event.touches.length === 1) {
        tap = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
          t: Date.now(),
          moved: false
        };
        if (frozen) {
          drag = { x: tap.x, y: tap.y, moved: false };
        }
      }
    }, { passive: true });

    view.addEventListener("touchmove", function (event) {
      if (guideDrag || touchOnGuide(event)) return;
      if (event.touches.length === 2 && view._pinch) {
        tap = null;
        event.preventDefault();
        lastPinch = Date.now();
        var dist = touchDistance(event.touches);
        if (view._pinch.dist > 0) {
          camera.setZoom(view._pinch.zoom * (dist / view._pinch.dist));
          showOverlay();
        }
        return;
      }
      if (tap && event.touches.length === 1) {
        var movedX = event.touches[0].clientX - tap.x;
        var movedY = event.touches[0].clientY - tap.y;
        if (Math.abs(movedX) + Math.abs(movedY) > 14) tap.moved = true;
      }
      if (!drag || !frozen || event.touches.length !== 1) return;
      event.preventDefault();
      var touch = event.touches[0];
      var dx = touch.clientX - drag.x;
      var dy = touch.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      drag.x = touch.clientX;
      drag.y = touch.clientY;
      var rect = view.getBoundingClientRect();
      renderer.panBy(dx, dy, rect.width, rect.height);
    }, { passive: false });

    view.addEventListener("touchend", function (event) {
      if (drag && drag.moved) lastPinch = Date.now();
      var endedTap = tap;
      if (event.touches.length < 1) {
        drag = null;
        tap = null;
      }
      if (view._pinch && event.touches.length < 2) {
        view._pinch = null;
        lastPinch = Date.now();
        announceZoom();
        endedTap = null;
      }
      if (endedTap && !endedTap.moved && event.touches.length === 0 && Date.now() - endedTap.t < 320) {
        focusAtPoint(endedTap.x, endedTap.y);
      }
    });

    var mousePan = null;
    var mouseTap = null;
    view.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "touch" || event.button !== 0) return;
      if (event.target.closest && event.target.closest(".guide-handle")) return;
      mouseTap = { x: event.clientX, y: event.clientY, moved: false };
      if (!frozen) return;
      mousePan = { x: event.clientX, y: event.clientY };
    });
    view.addEventListener("pointermove", function (event) {
      if (mouseTap) {
        if (Math.abs(event.clientX - mouseTap.x) + Math.abs(event.clientY - mouseTap.y) > 14) mouseTap.moved = true;
      }
      if (!mousePan) return;
      var dx = event.clientX - mousePan.x;
      var dy = event.clientY - mousePan.y;
      mousePan.x = event.clientX;
      mousePan.y = event.clientY;
      var rect = view.getBoundingClientRect();
      renderer.panBy(dx, dy, rect.width, rect.height);
    });
    view.addEventListener("pointerup", function (event) {
      if (mouseTap && !mouseTap.moved && event.pointerType !== "touch") focusAtPoint(mouseTap.x, mouseTap.y);
      mouseTap = null;
      mousePan = null;
    });
    view.addEventListener("pointercancel", function () { mouseTap = null; mousePan = null; });

    view.addEventListener("wheel", function (event) {
      if (event.target.closest && event.target.closest(".guide-handle")) return;
      event.preventDefault();
      var factor = event.deltaY < 0 ? 1.08 : (1 / 1.08);
      camera.setZoom(camera.getState().zoom * factor);
      showOverlay();
      scheduleZoomAnnounce();
    }, { passive: false });

    ["gesturestart", "gesturechange", "gestureend"].forEach(function (name) {
      document.addEventListener(name, function (event) { event.preventDefault(); }, { passive: false });
    });

    scroller.addEventListener("scroll", updateFades, { passive: true });
    function reflowGuide() {
      applyGuide();
      window.requestAnimationFrame(applyGuide);
    }

    var wasLandscape = isLandscape();
    window.addEventListener("resize", function () {
      applyUiScale();
      updateFades();
      reflowGuide();
      var now = isLandscape();
      if (now !== wasLandscape) {
        wasLandscape = now;
        applyOrientation();
      }
    });
    window.addEventListener("orientationchange", function () {
      reflowGuide();
      applyOrientation();
    });
    try {
      if (screen.orientation && screen.orientation.addEventListener) {
        screen.orientation.addEventListener("change", function () {
          reflowGuide();
          applyOrientation();
        });
      }
    } catch (err) { /* ohne Orientation API */ }
    if (window.ResizeObserver) new ResizeObserver(updateFades).observe(scroller);
    window.addEventListener("load", updateFades);
    scroller.scrollLeft = 0;
    updateFades();

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        renderer.stop();
        camera.stop();
        return;
      }
      renderer.start();
      if (usingDemo && /beispiel=1/.test(location.search)) {
        if (!frozen) renderer.setSource(demo);
        return;
      }
      boot();
    });

    window.addEventListener("pagehide", function () { camera.stop(); });

    var settingsEl = document.getElementById("settings");
    var guideSwitch = document.getElementById("guide-switch");
    var rememberSwitch = document.getElementById("remember-switch");
    var focusSwitch = document.getElementById("focus-switch");
    var focusNote = document.getElementById("focus-note");
    var focusRow = document.getElementById("focus-row");
    var brightSlider = document.getElementById("set-brightness");
    var contrastSlider = document.getElementById("set-contrast");
    var brightValue = document.getElementById("bright-value");
    var contrastValue = document.getElementById("contrast-value");
    var modePicks = document.getElementById("mode-picks");

    function percentText(value) { return value + " %"; }

    function syncAdjustLabels() {
      brightValue.textContent = percentText(settings.brightness);
      contrastValue.textContent = percentText(settings.contrast);
      brightSlider.value = String(settings.brightness);
      contrastSlider.value = String(settings.contrast);
      brightSlider.setAttribute("aria-valuetext", settings.brightness + " Prozent");
      contrastSlider.setAttribute("aria-valuetext", settings.contrast + " Prozent");
    }

    function syncGuideControls() {
      guideSwitch.setAttribute("aria-checked", settings.readingGuide ? "true" : "false");
      var sizes = document.querySelectorAll(".size-picks button");
      var i;
      for (i = 0; i < sizes.length; i += 1) {
        sizes[i].setAttribute("aria-pressed", sizes[i].getAttribute("data-size") === settings.guideSize ? "true" : "false");
      }
    }

    SBL.MODES.forEach(function (item) {
      var row = document.createElement("div");
      row.className = "pick-row";
      var name = document.createElement("span");
      name.textContent = item.label;
      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "switch";
      toggle.setAttribute("role", "switch");
      toggle.setAttribute("aria-label", item.label);
      row.appendChild(name);
      if (item.id === "normal") {
        row.classList.add("is-locked");
        var note = document.createElement("span");
        note.className = "pick-note";
        note.textContent = "immer an";
        row.appendChild(note);
        toggle.disabled = true;
        toggle.setAttribute("aria-checked", "true");
        toggle.setAttribute("aria-label", "Normal, immer eingeschaltet");
      } else {
        toggle.setAttribute("aria-checked", settings.modes[item.id] !== false ? "true" : "false");
        toggle.addEventListener("click", function () {
          var on = toggle.getAttribute("aria-checked") !== "true";
          toggle.setAttribute("aria-checked", on ? "true" : "false");
          settings.modes[item.id] = on;
          SBL.saveSettings(settings);
          if (!on && mode.id === item.id) {
            selectMode(SBL.modeById("normal"), false);
            announce("Darstellung Normal");
          }
        });
      }
      row.appendChild(toggle);
      modePicks.appendChild(row);
    });

    guideSwitch.addEventListener("click", function () {
      settings.readingGuide = guideSwitch.getAttribute("aria-checked") !== "true";
      guideSwitch.setAttribute("aria-checked", settings.readingGuide ? "true" : "false");
      SBL.saveSettings(settings);
      applyGuide();
      applyOrientation();
    });

    function syncTextChoices() {
      var buttons = document.querySelectorAll("[data-text]");
      var current = settings.textSize || "normal";
      var i;
      for (i = 0; i < buttons.length; i += 1) {
        buttons[i].setAttribute("aria-checked", buttons[i].getAttribute("data-text") === current ? "true" : "false");
      }
    }

    document.querySelectorAll("[data-text]").forEach(function (button) {
      button.addEventListener("click", function () {
        var next = button.getAttribute("data-text");
        if (next !== "normal" && next !== "gross" && next !== "sehr-gross") return;
        settings.textSize = next;
        SBL.saveSettings(settings);
        syncTextChoices();
        applyUiScale();
        updateDebug();
      });
    });

    function syncRotateChoices() {
      var buttons = document.querySelectorAll(".rotate-choice");
      var i;
      for (i = 0; i < buttons.length; i += 1) {
        var on = buttons[i].getAttribute("data-rotate") === settings.rotate;
        buttons[i].setAttribute("aria-checked", on ? "true" : "false");
      }
    }

    document.querySelectorAll(".rotate-choice").forEach(function (button) {
      button.addEventListener("click", function () {
        var next = button.getAttribute("data-rotate");
        if (next !== "follow" && next !== "guide" && next !== "lock") return;
        settings.rotate = next;
        SBL.saveSettings(settings);
        syncRotateChoices();
        applyOrientation();
      });
    });

    function moveGuide(next, announceText) {
      settings.guideOffset = SBL.clampGuide(next, settings.guideSize);
      applyGuide();
      persistGuide();
      if (announceText) announce(announceText);
    }

    var guideHandle = document.getElementById("guide-handle");
    guideHandle.addEventListener("click", function (event) { event.stopPropagation(); });
    guideHandle.addEventListener("touchstart", function (event) {
      event.stopPropagation();
    }, { passive: true });
    guideHandle.addEventListener("touchmove", function (event) {
      event.stopPropagation();
      if (guideDrag) event.preventDefault();
    }, { passive: false });
    guideHandle.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      guideDrag = { id: event.pointerId, y: event.clientY, moved: false };
      drag = null;
      tap = null;
      view._pinch = null;
      mousePan = null;
      if (guideHandle.setPointerCapture) {
        try { guideHandle.setPointerCapture(event.pointerId); } catch (err) { /* synthetisches Ereignis */ }
      }
    });
    guideHandle.addEventListener("pointermove", function (event) {
      if (!guideDrag || event.pointerId !== guideDrag.id) return;
      event.preventDefault();
      event.stopPropagation();
      var rect = view.getBoundingClientRect();
      var dy = event.clientY - guideDrag.y;
      if (Math.abs(dy) > 2) guideDrag.moved = true;
      guideDrag.y = event.clientY;
      if (!rect.height) return;
      settings.guideOffset = SBL.clampGuide(settings.guideOffset + dy / rect.height, settings.guideSize);
      applyGuide();
    });
    function endGuideDrag(event) {
      if (!guideDrag || (event && event.pointerId !== guideDrag.id)) return;
      var moved = guideDrag.moved;
      guideDrag = null;
      if (moved) persistGuide();
    }
    guideHandle.addEventListener("pointerup", endGuideDrag);
    guideHandle.addEventListener("pointercancel", endGuideDrag);
    document.getElementById("guide-grip").addEventListener("keydown", function (event) {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      var direction = event.key === "ArrowUp" ? -1 : 1;
      moveGuide(
        SBL.nudgeGuide(settings.guideOffset, settings.guideSize, direction),
        direction < 0 ? "Lesezeile nach oben." : "Lesezeile nach unten."
      );
    });

    document.querySelectorAll(".size-picks button").forEach(function (button) {
      button.addEventListener("click", function () {
        settings.guideSize = button.getAttribute("data-size");
        settings.guideOffset = SBL.clampGuide(settings.guideOffset, settings.guideSize);
        SBL.saveSettings(settings);
        syncGuideControls();
        applyGuide();
      });
    });

    function setMenuSlider(input, raw) {
      var min = parseFloat(input.min);
      var max = parseFloat(input.max);
      var step = parseFloat(input.step) || 1;
      var next = Math.round(raw / step) * step;
      if (next < min) next = min;
      if (next > max) next = max;
      input.value = String(next);
      if (input === brightSlider) settings.brightness = next;
      else settings.contrast = next;
      syncAdjustLabels();
      SBL.saveSettings(settings);
      applyAdjust();
    }

    function bindMenuSlider(input) {
      var field = input.parentNode;
      var drag = null;

      function valueAt(clientX) {
        var rect = field.getBoundingClientRect();
        return SBL.sliderValueAt(clientX, rect.left, rect.width, parseFloat(input.min), parseFloat(input.max));
      }

      function lockSlide(pointerId) {
        if (!drag || drag.sliding) return;
        drag.sliding = true;
        if (pointerId !== undefined && field.setPointerCapture) {
          try { field.setPointerCapture(pointerId); } catch (err) {}
        }
      }

      field.addEventListener("pointerdown", function (event) {
        if (event.button !== 0) return;
        if (event.target.closest && event.target.closest(".step-btn")) return;
        drag = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          sliding: false,
          scroll: false
        };
      });
      field.addEventListener("pointermove", function (event) {
        if (!drag || event.pointerId !== drag.id || drag.scroll) return;
        var gesture = SBL.sliderGesture(event.clientX - drag.x, event.clientY - drag.y, drag.sliding);
        if (gesture === "wait") return;
        if (gesture === "scroll") {
          drag.scroll = true;
          return;
        }
        lockSlide(event.pointerId);
        if (event.cancelable) event.preventDefault();
        setMenuSlider(input, valueAt(event.clientX));
      });
      field.addEventListener("pointerup", function (event) {
        if (!drag || event.pointerId !== drag.id) return;
        drag = null;
      });
      field.addEventListener("pointercancel", function (event) {
        if (!drag || event.pointerId !== drag.id) return;
        if (drag.sliding) {
          drag.pointerLost = true;
          return;
        }
        drag = null;
      });

      field.addEventListener("touchmove", function (event) {
        if (!drag || !drag.sliding) return;
        if (event.cancelable) event.preventDefault();
        if (!drag.pointerLost || !event.touches || !event.touches.length) return;
        setMenuSlider(input, valueAt(event.touches[0].clientX));
      }, { passive: false });
      field.addEventListener("touchend", function () {
        if (drag && drag.pointerLost) drag = null;
      });
      field.addEventListener("touchcancel", function () {
        if (drag && drag.pointerLost) drag = null;
      });

      input.addEventListener("input", function () {
        setMenuSlider(input, parseFloat(input.value));
      });
    }

    bindMenuSlider(brightSlider);
    bindMenuSlider(contrastSlider);
    document.getElementById("bright-down").addEventListener("click", function () {
      setMenuSlider(brightSlider, parseFloat(brightSlider.value) - parseFloat(brightSlider.step || "5"));
    });
    document.getElementById("bright-up").addEventListener("click", function () {
      setMenuSlider(brightSlider, parseFloat(brightSlider.value) + parseFloat(brightSlider.step || "5"));
    });
    document.getElementById("contrast-down").addEventListener("click", function () {
      setMenuSlider(contrastSlider, parseFloat(contrastSlider.value) - parseFloat(contrastSlider.step || "5"));
    });
    document.getElementById("contrast-up").addEventListener("click", function () {
      setMenuSlider(contrastSlider, parseFloat(contrastSlider.value) + parseFloat(contrastSlider.step || "5"));
    });
    document.getElementById("set-reset").addEventListener("click", function () {
      settings.brightness = 100;
      settings.contrast = 100;
      syncAdjustLabels();
      SBL.saveSettings(settings);
      applyAdjust();
      showModeHint("Helligkeit und Kontrast zurückgesetzt");
      announce("Helligkeit und Kontrast zurückgesetzt.");
    });
    rememberSwitch.addEventListener("click", function () {
      settings.remember = rememberSwitch.getAttribute("aria-checked") !== "true";
      rememberSwitch.setAttribute("aria-checked", settings.remember ? "true" : "false");
      if (settings.remember) {
        storageSet("sblupe-mode", mode.id);
        storageSet("sblupe-zoom", String(camera.getState().zoom));
      }
      SBL.saveSettings(settings);
    });
    document.getElementById("set-switch").addEventListener("click", switchCamera);

    function refreshFocusSwitch() {
      var supported = false;
      try { supported = camera.focusCapabilities().supported; } catch (err) { supported = false; }
      if (!supported) {
        focusSwitch.disabled = true;
        focusSwitch.setAttribute("aria-checked", "false");
        focusRow.classList.add("is-locked");
        focusNote.hidden = false;
        return;
      }
      focusSwitch.disabled = false;
      focusRow.classList.remove("is-locked");
      focusNote.hidden = true;
      focusSwitch.setAttribute("aria-checked", settings.tapFocus ? "true" : "false");
    }

    focusSwitch.addEventListener("click", function () {
      if (focusSwitch.disabled) return;
      settings.tapFocus = focusSwitch.getAttribute("aria-checked") !== "true";
      focusSwitch.setAttribute("aria-checked", settings.tapFocus ? "true" : "false");
      SBL.saveSettings(settings);
    });

    var installSection = document.getElementById("install-section");
    var installNote = document.getElementById("install-note");
    var installHint = document.getElementById("install-hint");
    var installHintText = document.getElementById("install-hint-text");

    function refreshInstall() {
      var installed = appIsInstalled();
      if (installSection) installSection.hidden = installed;
      if (installed && installHint) installHint.hidden = true;
    }

    function showInstallInstructions() {
      var text = SBL.installCopy(thisPlatform());
      if (installNote) {
        installNote.hidden = false;
        installNote.textContent = text;
      }
      announce(text);
    }

    document.getElementById("install-app").addEventListener("click", function () {
      if (installPromptEvent && typeof installPromptEvent.prompt === "function") {
        var pending = installPromptEvent;
        installPromptEvent = null;
        var prompted;
        try {
          prompted = pending.prompt();
        } catch (err) {
          showInstallInstructions();
          return;
        }
        Promise.resolve(prompted).then(function () {
          if (pending.userChoice && typeof pending.userChoice.then === "function") return pending.userChoice;
        }).then(function () {
          refreshInstall();
        }).catch(function () {
          showInstallInstructions();
        });
        return;
      }
      showInstallInstructions();
    });

    document.getElementById("install-hint-ok").addEventListener("click", function () {
      storageSet(INSTALL_SEEN, "1");
      installHint.hidden = true;
    });

    function maybeShowInstallHint() {
      if (appIsInstalled()) return;
      if (storageGet(INSTALL_SEEN) === "1") return;
      installHintText.textContent = SBL.installCopy(thisPlatform());
      installHint.hidden = false;
    }

    function openSettings() {
      settingsEl.hidden = false;
      refreshInstall();
      refreshCameraChoices();
      refreshFocusSwitch();
      var title = document.getElementById("settings-title");
      if (title) title.focus();
    }
    function closeSettings() {
      settingsEl.hidden = true;
      settingsButton.focus();
    }
    settingsButton.addEventListener("click", openSettings);
    document.getElementById("settings-done").addEventListener("click", closeSettings);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !settingsEl.hidden) closeSettings();
    });

    syncGuideControls();
    syncTextChoices();
    syncRotateChoices();
    syncAdjustLabels();
    rememberSwitch.setAttribute("aria-checked", settings.remember ? "true" : "false");
    applyUiScale();
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", applyUiScale);
    }
    applyGuide();
    applyAdjust();
    applyOrientation();
    refreshFocusSwitch();
    refreshInstall();
    maybeShowInstallHint();
    updateDebug();

    var beispiel = /(?:\?|&)beispiel=1(?:&|$)/.test(location.search);
    if (beispiel) {
      useDemo("beispiel");
      refreshCameraChoices();
    } else {
      boot().then(refreshCameraChoices, refreshCameraChoices);
    }

    SBL.app = {
      camera: camera,
      renderer: renderer,
      selectMode: function (id) { selectMode(SBL.modeById(id), true); },
      updateFades: updateFades,
      refreshInstall: refreshInstall
    };

    if ("serviceWorker" in navigator && /\/$|index\.html$|Lupe_3\.html$/.test(location.pathname)) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }

  function touchDistance(touches) {
    var dx = touches[0].clientX - touches[1].clientX;
    var dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window.SBL = window.SBL || {});
