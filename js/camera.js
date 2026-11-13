/* Kamera, Hardware-Zoom, Digitalzoom, Licht und Wechsel Rück/Front.
   iOS Safari kann Zoom und Licht oft nicht; dann bleibt der Digitalzoom. */
(function (SBL) {
  "use strict";

  var ZOOM_MAX = 10;
  var STOPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

  function fail(code, original) {
    var error = new Error(code);
    error.code = code;
    if (original) error.cause = original;
    return error;
  }

  function normalizeError(err) {
    if (!window.isSecureContext) return fail("insecure", err);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return fail("missing", err);
    }
    var name = err && err.name;
    if (name === "NotAllowedError" || name === "PermissionDeniedError") return fail("denied", err);
    if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
      return fail("missing", err);
    }
    if (name === "NotReadableError" || name === "TrackStartError") return fail("busy", err);
    if (name === "SecurityError") return fail("insecure", err);
    return fail("unknown", err);
  }

  function Camera(video) {
    this.video = video;
    this.track = null;
    this.facing = "environment";
    this.listeners = [];
    this.generation = 0;
    this.zoomChain = Promise.resolve();
    this.state = {
      active: false,
      facing: "environment",
      zoom: 1,
      zoomMin: 1,
      zoomMax: ZOOM_MAX,
      opticalMax: 1,
      zoomCapable: false,
      digitalScale: 1,
      digital: false,
      torch: false,
      torchSupported: false
    };
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;
  }

  Camera.prototype.onChange = function (fn) {
    this.listeners.push(fn);
    return fn;
  };

  Camera.prototype.emit = function () {
    var snapshot = {
      active: this.state.active,
      facing: this.state.facing,
      zoom: this.state.zoom,
      zoomMin: this.state.zoomMin,
      zoomMax: this.state.zoomMax,
      opticalMax: this.state.opticalMax,
      zoomCapable: this.state.zoomCapable,
      digitalScale: this.state.digitalScale,
      digital: this.state.digital,
      torch: this.state.torch,
      torchSupported: this.state.torchSupported
    };
    for (var i = 0; i < this.listeners.length; i += 1) {
      this.listeners[i](snapshot);
    }
  };

  Camera.prototype.getState = function () {
    return this.state;
  };

  Camera.prototype.stop = function () {
    this.generation += 1;
    this.state.active = false;
    this.state.torch = false;
    if (this.video.srcObject) {
      var tracks = this.video.srcObject.getTracks();
      for (var i = 0; i < tracks.length; i += 1) tracks[i].stop();
      this.video.srcObject = null;
    }
    this.track = null;
    this.emit();
  };

  Camera.prototype.start = function () {
    var self = this;
    if (!window.isSecureContext) return Promise.reject(fail("insecure"));
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(fail("missing"));
    }
    var generation = this.generation + 1;
    this.generation = generation;
    this.stopTracksOnly();

    return this.openStream(this.facing).then(function (stream) {
      if (generation !== self.generation) {
        stream.getTracks().forEach(function (track) { track.stop(); });
        return;
      }
        self.video.srcObject = stream;
        self.track = stream.getVideoTracks()[0] || null;
        self.rememberTrack(self.track);
        self.state.active = true;
        self.state.facing = self.facing;
        self.state.torch = false;
      self.video.onloadedmetadata = function () {
        if (generation !== self.generation) return;
        self.readCapabilities();
      };
      if (self.track) {
        self.track.addEventListener("unmute", function () {
          if (generation !== self.generation) return;
          self.readCapabilities();
        });
      }
      return self.waitUntilPlaying().then(function () {
        if (generation !== self.generation) return;
        self.readCapabilities();
      });
    }).catch(function (err) {
      if (generation === self.generation) {
        self.state.active = false;
        self.emit();
      }
      if (err && err.code) throw err;
      throw normalizeError(err);
    });
  };

  Camera.prototype.stopTracksOnly = function () {
    if (this.video.srcObject) {
      var tracks = this.video.srcObject.getTracks();
      for (var i = 0; i < tracks.length; i += 1) tracks[i].stop();
      this.video.srcObject = null;
    }
    this.track = null;
    this.state.active = false;
    this.capSignature = "";
  };

  /* Obergrenze 2560×1440: 4K jedes Bild in WebGL kostet auf schwachen Handys zu viel. */
  SBL.resolutionLadder = [[2560, 1440], [1920, 1080], [1280, 720]];

  SBL.cameraHasZoomOrTorch = function (caps) {
    if (!caps) return false;
    var zoom = caps.zoom;
    if (zoom && typeof zoom.max === "number" && zoom.max > (zoom.min || 1) + 0.05) return true;
    return caps.torch === true;
  };

  /* Nur herunterstufen, wenn die kleinere Auflösung Zoom oder Licht hat und die große nicht. */
  SBL.preferLowerForZoom = function (highCaps, lowCaps) {
    if (SBL.cameraHasZoomOrTorch(highCaps)) return false;
    return SBL.cameraHasZoomOrTorch(lowCaps);
  };

  Camera.prototype.trackCaps = function (track) {
    try { return track && track.getCapabilities ? track.getCapabilities() || {} : {}; } catch (err) { return {}; }
  };

  Camera.prototype.stopStream = function (stream) {
    if (!stream) return;
    stream.getTracks().forEach(function (track) { try { track.stop(); } catch (err) {} });
  };

  SBL.cameraReportsControls = function (caps) {
    if (!caps) return false;
    var key;
    for (key in caps) {
      if (Object.prototype.hasOwnProperty.call(caps, key)) return true;
    }
    return false;
  };

  /* Zweite Kamera nicht parallel öffnen: viele Handys blockieren das.
     Die laufende Spur wird stufenweise verkleinert und nur behalten,
     wenn Zoom oder Licht dadurch dazukommen. Sonst wieder die hohe Stufe. */
  Camera.prototype.keepZoomOrTorch = function (stream, index) {
    var self = this;
    var ladder = SBL.resolutionLadder;
    var track = stream.getVideoTracks()[0];
    var caps = this.trackCaps(track);
    if (!track || !track.applyConstraints || index >= ladder.length - 1) return Promise.resolve(stream);
    if (!SBL.cameraReportsControls(caps) || SBL.cameraHasZoomOrTorch(caps)) return Promise.resolve(stream);
    var high = ladder[index];

    function widthOf() {
      try { return (track.getSettings() || {}).width || 0; } catch (err) { return 0; }
    }

    function restore() {
      return track.applyConstraints({
        width: { ideal: high[0] },
        height: { ideal: high[1] }
      }).then(function () { return stream; }).catch(function () { return stream; });
    }

    function tryIndex(i) {
      if (i >= ladder.length) return restore();
      var before = widthOf();
      var size = ladder[i];
      return track.applyConstraints({
        width: { ideal: size[0] },
        height: { ideal: size[1] }
      }).then(function () {
        if (SBL.cameraHasZoomOrTorch(self.trackCaps(track))) return stream;
        var after = widthOf();
        if (before && after && after >= before - 16) return restore();
        return tryIndex(i + 1);
      }).catch(function () { return restore(); });
    }

    return tryIndex(index + 1);
  };

  Camera.prototype.openSized = function (baseVideo, index) {
    var ladder = SBL.resolutionLadder;
    if (index > ladder.length) return Promise.reject(new Error("missing"));
    var video = {};
    var key;
    for (key in baseVideo) {
      if (Object.prototype.hasOwnProperty.call(baseVideo, key)) video[key] = baseVideo[key];
    }
    if (index < ladder.length) {
      video.width = { ideal: ladder[index][0] };
      video.height = { ideal: ladder[index][1] };
    }
    return navigator.mediaDevices.getUserMedia({ video: video, audio: false });
  };

  Camera.prototype.openPreferredAt = function (baseVideo, index) {
    var self = this;
    return this.openSized(baseVideo, index).then(function (stream) {
      return self.keepZoomOrTorch(stream, index);
    });
  };

  Camera.prototype.openPreferred = function (baseVideo) {
    var self = this;
    function attempt(index) {
      return self.openPreferredAt(baseVideo, index).catch(function (err) {
        if (err && err.name) self.lastError = err.name;
        if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) return Promise.reject(err);
        if (index >= SBL.resolutionLadder.length) return Promise.reject(err || new Error("missing"));
        return attempt(index + 1);
      });
    }
    return attempt(0);
  };

  Camera.prototype.openStream = function (facing) {
    var self = this;
    return this.openPreferred({ facingMode: { exact: facing } }).catch(function (err) {
      if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) return Promise.reject(err);
      return self.openPreferred({ facingMode: facing });
    }).catch(function (err) {
      if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) return Promise.reject(err);
      if (facing === "environment") {
        return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      return Promise.reject(err || new Error("missing"));
    });
  };

  Camera.prototype.readCapabilities = function () {
    var track = this.track;
    if (!track || typeof track.getCapabilities !== "function") {
      this.state.zoomCapable = false;
      this.state.torchSupported = false;
      this.state.opticalMax = 1;
      this.emit();
      return;
    }
    var caps;
    try {
      caps = track.getCapabilities() || {};
    } catch (err) {
      caps = {};
    }

    this.captureFrameInfo(track);
    var zoomCaps = caps.zoom || {};
    var signature = [
      zoomCaps.min, zoomCaps.max, zoomCaps.step, caps.torch === true
    ].join("|");
    if (signature === this.capSignature) return;
    this.capSignature = signature;

    if (caps.zoom && typeof caps.zoom.max === "number") {
      this.state.zoomCapable = true;
      this.state.zoomMin = caps.zoom.min || 1;
      this.state.opticalMax = caps.zoom.max;
      this.state.zoomMax = Math.max(caps.zoom.max, ZOOM_MAX);
      this.zoomStep = caps.zoom.step || 0;
      this.opticalMin = caps.zoom.min || 1;
    } else {
      this.state.zoomCapable = false;
      this.state.zoomMin = 1;
      this.state.opticalMax = 1;
      this.state.zoomMax = ZOOM_MAX;
      this.zoomStep = 0;
      this.opticalMin = 1;
    }

    this.state.torchSupported = caps.torch === true;

    if (caps.focusMode && caps.focusMode.indexOf("continuous") !== -1) {
      track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(function () {});
    }

    this.setZoom(this.state.zoom);
  };

  Camera.prototype.setFacing = function (facing) {
    if (facing === "user" || facing === "environment") this.facing = facing;
  };

  Camera.prototype.waitUntilPlaying = function () {
    var video = this.video;
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        resolve();
      }
      Promise.resolve(video.play()).then(finish).catch(finish);
      setTimeout(finish, 1200);
    });
  };

  Camera.prototype.clampZoom = function (value) {
    var min = this.state.zoomMin;
    var max = this.state.zoomMax;
    if (value < min) return min;
    if (value > max) return max;
    return value;
  };

  Camera.prototype.setZoom = function (value) {
    var next = this.clampZoom(value);
    this.state.zoom = next;
    this.updateDigitalFlag(next);
    this.emit();
    var self = this;
    this.zoomChain = this.zoomChain.then(function () {
      return self.applyZoom(self.state.zoom);
    }).catch(function () {});
    return next;
  };

  Camera.prototype.stepZoom = function (direction) {
    var current = this.state.zoom;
    var target = null;
    if (direction > 0) {
      for (var i = 0; i < STOPS.length; i += 1) {
        if (STOPS[i] > current + 0.05 && STOPS[i] <= this.state.zoomMax + 0.001) {
          target = STOPS[i];
          break;
        }
      }
      if (target === null) target = Math.min(this.state.zoomMax, current * 1.25);
    } else {
      for (var j = STOPS.length - 1; j >= 0; j -= 1) {
        if (STOPS[j] < current - 0.05 && STOPS[j] >= this.state.zoomMin - 0.001) {
          target = STOPS[j];
          break;
        }
      }
      if (target === null) target = Math.max(this.state.zoomMin, current / 1.25);
    }
    return this.setZoom(target);
  };

  Camera.prototype.setFreezeZoom = function (on) {
    this.freezeZoom = !!on;
    this.setZoom(this.state.zoom);
  };

  Camera.prototype.updateDigitalFlag = function (value) {
    var hardware = this.freezeZoom ? this.state.zoomMin : Math.min(value, this.state.opticalMax);
    this.hardwareZoom = hardware;
    var scale = (!this.freezeZoom && this.state.zoomCapable) ? value / Math.max(hardware, 0.01) : value / Math.max(this.state.zoomMin, 0.01);
    if (!isFinite(scale) || scale < 1) scale = 1;
    this.state.digitalScale = scale;
    this.state.digital = scale > 1.02;
  };

  Camera.prototype.applyZoom = function (value) {
    var self = this;
    this.updateDigitalFlag(value);
    if (this.freezeZoom || !this.state.zoomCapable || !this.track) {
      this.emit();
      return Promise.resolve();
    }
    var hardware = Math.min(value, this.state.opticalMax);
    hardware = this.snapHardware(hardware);
    return this.track.applyConstraints({ advanced: [{ zoom: hardware }] }).then(function () {
      self.updateDigitalFlag(self.state.zoom);
      self.captureFrameInfo(self.track);
      self.emit();
    }).catch(function () {
      self.state.zoomCapable = false;
      self.state.opticalMax = 1;
      self.updateDigitalFlag(self.state.zoom);
      self.emit();
    });
  };

  Camera.prototype.snapHardware = function (value) {
    if (!this.zoomStep) return value;
    var snapped = this.opticalMin + Math.round((value - this.opticalMin) / this.zoomStep) * this.zoomStep;
    if (snapped < this.opticalMin) snapped = this.opticalMin;
    if (snapped > this.state.opticalMax) snapped = this.state.opticalMax;
    return snapped;
  };

  Camera.prototype.focusCapabilities = function () {
    var track = this.track;
    if (!track || typeof track.getCapabilities !== "function") return { supported: false, focusMode: "" };
    var caps = {};
    try { caps = track.getCapabilities() || {}; } catch (err) { return { supported: false, focusMode: "" }; }
    var modes = caps.focusMode || [];
    var poi = caps.pointsOfInterest;
    var poiOk = poi === true || (poi && typeof poi === "object");
    var focusMode = "";
    if (modes.indexOf("single-shot") !== -1) focusMode = "single-shot";
    else if (modes.indexOf("continuous") !== -1) focusMode = "continuous";
    return { supported: !!(poiOk && focusMode && this.state.active), focusMode: focusMode };
  };

  Camera.prototype.focusAt = function (x, y) {
    var info = this.focusCapabilities();
    if (!info.supported || !this.track) return Promise.resolve(false);
    var point = {
      x: x < 0 ? 0 : (x > 1 ? 1 : x),
      y: y < 0 ? 0 : (y > 1 ? 1 : y)
    };
    var track = this.track;
    function attempt(advanced) {
      return track.applyConstraints({ advanced: [advanced] });
    }
    return attempt({ pointsOfInterest: [point], focusMode: info.focusMode }).then(function () {
      return true;
    }).catch(function () {
      return attempt({ pointsOfInterest: [point] }).then(function () {
        return true;
      }).catch(function () {
        return false;
      });
    });
  };

  Camera.prototype.toggleTorch = function () {
    var self = this;
    if (!this.track || !this.state.torchSupported) {
      return Promise.reject(fail("torch"));
    }
    var next = !this.state.torch;
    return this.track.applyConstraints({ advanced: [{ torch: next }] }).then(function () {
      self.state.torch = next;
      self.emit();
      return next;
    }).catch(function (err) {
      throw fail("torch", err);
    });
  };

  Camera.prototype.captureFrameInfo = function (track) {
    var settings = {};
    try { settings = track && track.getSettings ? track.getSettings() : {}; } catch (err) {}
    if (settings.width) this.frameWidth = settings.width;
    if (settings.height) this.frameHeight = settings.height;
    if (typeof settings.zoom === "number") this.hardwareZoom = settings.zoom;
  };

  Camera.prototype.trackInfo = function (track) {
    var settings = {};
    try { settings = track && track.getSettings ? track.getSettings() : {}; } catch (err) {}
    return {
      deviceId: settings.deviceId || "",
      facingMode: settings.facingMode || ""
    };
  };

  Camera.prototype.rememberTrack = function (track) {
    var info = this.trackInfo(track);
    if (info.deviceId) this.deviceId = info.deviceId;
    this.reportedFacing = info.facingMode || "";
    try { this.trackLabel = (track && track.label) || ""; } catch (err) { this.trackLabel = ""; }
  };

  Camera.prototype.labelFacing = function (label) {
    var text = label || "";
    if (/front|user|face|vorne|selfie|facetime/i.test(text)) return "user";
    if (/back|rear|environment|rück|rueck|hinten/i.test(text)) return "environment";
    return "";
  };

  Camera.prototype.listCameras = function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return Promise.resolve([]);
    }
    return navigator.mediaDevices.enumerateDevices().then(function (list) {
      var seen = {};
      var cameras = [];
      var i;
      for (i = 0; i < list.length; i += 1) {
        if (list[i].kind !== "videoinput" || !list[i].deviceId || seen[list[i].deviceId]) continue;
        seen[list[i].deviceId] = true;
        cameras.push(list[i]);
      }
      return cameras;
    }).catch(function () { return []; });
  };

  Camera.prototype.releaseHardware = function () {
    var video = this.video;
    var tracks = video.srcObject && video.srcObject.getTracks ? video.srcObject.getTracks() : [];
    var i;
    for (i = 0; i < tracks.length; i += 1) {
      try { tracks[i].stop(); } catch (err) {}
    }
    video.srcObject = null;
    try { video.pause(); } catch (err) {}
    this.track = null;
    this.state.active = false;
    this.state.torch = false;
    this.capSignature = "";
    return new Promise(function (resolve) { setTimeout(resolve, 300); });
  };

  Camera.prototype.tryConstraints = function (attempts) {
    function step(index, lastError) {
      if (index >= attempts.length) return Promise.reject(lastError || new Error("missing"));
      return navigator.mediaDevices.getUserMedia(attempts[index]).catch(function (err) {
        if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) return Promise.reject(err);
        return step(index + 1, err);
      });
    }
    return step(0, null);
  };

  Camera.prototype.useStream = function (stream, facing, generation) {
    var self = this;
    if (generation !== this.generation) {
      stream.getTracks().forEach(function (track) { try { track.stop(); } catch (err) {} });
      return Promise.resolve(false);
    }
    this.video.srcObject = stream;
    this.track = stream.getVideoTracks()[0] || null;
    this.rememberTrack(this.track);
    if (!this.facing && facing) this.facing = facing;
    this.state.active = true;
    this.state.facing = this.facing;
    this.state.torch = false;
    this.capSignature = "";
    this.video.onloadedmetadata = function () {
      if (generation !== self.generation) return;
      self.readCapabilities();
    };
    if (this.track) {
      this.track.addEventListener("unmute", function () {
        if (generation !== self.generation) return;
        self.readCapabilities();
      });
    }
    return this.waitUntilPlaying().then(function () {
      if (generation !== self.generation) return false;
      self.readCapabilities();
      return true;
    });
  };

  Camera.prototype.openById = function (deviceId) {
    var self = this;
    return this.openPreferred({ deviceId: { exact: deviceId } }).catch(function (err) {
      if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) return Promise.reject(err);
      return self.openPreferred({ deviceId: deviceId });
    });
  };

  Camera.prototype.acquireDifferentCamera = function (desiredFacing, oldFacing, oldId) {
    var self = this;
    var bases = [
      { facingMode: { exact: desiredFacing } },
      { facingMode: { ideal: desiredFacing } },
      { facingMode: desiredFacing }
    ];

    function sameCamera(info) {
      if (oldId && info.deviceId && info.deviceId === oldId) return true;
      if (info.facingMode && oldFacing && info.facingMode === oldFacing && (!info.deviceId || info.deviceId === oldId)) return true;
      return false;
    }

    function tryFacing(index) {
      if (index >= bases.length) return Promise.resolve(null);
      return self.openPreferred(bases[index]).then(function (stream) {
        var info = self.trackInfo(stream.getVideoTracks()[0]);
        if (!sameCamera(info)) {
          return { stream: stream, facing: info.facingMode || desiredFacing };
        }
        self.stopStream(stream);
        return tryFacing(index + 1);
      }).catch(function (err) {
        if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) return Promise.reject(err);
        return tryFacing(index + 1);
      });
    }

    return tryFacing(0).then(function (found) {
      if (found) return found;
      return self.listCameras().then(function (cameras) {
        if (cameras.length < 2) return null;
        var start = 0;
        var i;
        for (i = 0; i < cameras.length; i += 1) {
          if (cameras[i].deviceId === oldId) start = i;
        }
        function tryDevice(step) {
          if (step >= cameras.length) return Promise.resolve(null);
          var device = cameras[(start + 1 + step) % cameras.length];
          if (!device.deviceId || device.deviceId === oldId) return tryDevice(step + 1);
          return self.openById(device.deviceId).then(function (stream) {
            var info = self.trackInfo(stream.getVideoTracks()[0]);
            var id = info.deviceId || device.deviceId;
            if (oldId && id === oldId) {
              stream.getTracks().forEach(function (track) { try { track.stop(); } catch (err) {} });
              return tryDevice(step + 1);
            }
            var facing = info.facingMode;
            if (facing !== "user" && facing !== "environment") {
              facing = /front|user|face|vorne|selfie/i.test(device.label || "") ? "user" : desiredFacing;
            }
            return { stream: stream, facing: facing };
          }).catch(function (err) {
            if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) return Promise.reject(err);
            return tryDevice(step + 1);
          });
        }
        return tryDevice(0);
      });
    });
  };

  Camera.prototype.restoreCamera = function (facing, deviceId, generation) {
    var self = this;
    var bases = [];
    if (deviceId) bases.push({ deviceId: { exact: deviceId } });
    if (facing) {
      bases.push({ facingMode: { exact: facing } });
      bases.push({ facingMode: { ideal: facing } });
    }
    function step(index) {
      if (index >= bases.length) {
        return navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(function (stream) {
          return self.useStream(stream, facing, generation);
        }).catch(function () {});
      }
      return self.openPreferred(bases[index]).then(function (stream) {
        return self.useStream(stream, facing, generation);
      }).catch(function (err) {
        if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) return;
        return step(index + 1);
      });
    }
    return step(0);
  };

  Camera.prototype.playVideo = function () {
    var video = this.video;
    if (!video) return Promise.resolve();
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        resolve();
      }
      try {
        var result = video.play();
        if (result && typeof result.then === "function") result.then(finish).catch(finish);
        else finish();
      } catch (err) {
        finish();
      }
      setTimeout(finish, 400);
    });
  };

  /* Reine Entscheidung, ohne Browser: Erfolg, wenn die Geräte-ID wechselt
     oder facingMode die gewünschte Seite ist. Sonst die andere deviceId. */
  SBL.planCameraSwitch = function (state) {
    var desired = state.desired === "user" ? "user" : "environment";
    var oldId = state.oldId || "";
    var gotId = state.gotId || "";
    var gotFacing = state.gotFacing || "";
    var devices = state.devices || [];
    if ((gotId && oldId && gotId !== oldId) || gotFacing === desired || gotFacing === "user" && desired === "user") {
      return { action: "keep", deviceId: gotId };
    }
    var other = "";
    var i;
    for (i = 0; i < devices.length; i += 1) {
      var id = devices[i].deviceId || "";
      if (id && id !== oldId && id !== gotId) {
        other = id;
        break;
      }
    }
    if (other) return { action: "use-device", deviceId: other };
    if (!state.errorName && (gotId || gotFacing)) return { action: "keep", deviceId: gotId };
    return { action: "fail", deviceId: "" };
  };

  Camera.prototype.keepOrOther = function (previous, oldId) {
    var self = this;
    var now = this.track ? this.trackInfo(this.track) : { deviceId: "", facingMode: "" };
    return this.listCameras().then(function (devices) {
      var plan = SBL.planCameraSwitch({
        desired: self.desiredFacing,
        oldId: oldId,
        gotId: now.deviceId,
        gotFacing: now.facingMode,
        errorName: self.lastError,
        devices: devices
      });
      if (plan.action !== "use-device") {
        self.facing = self.desiredFacing;
        self.state.facing = self.desiredFacing;
        self.switching = false;
        return { facing: self.facing };
      }
      if (!self.lastError) self.lastError = "SameCamera";
      return self.releaseHardware().then(function () {
        return self.openById(plan.deviceId);
      }).then(function (stream) {
        return self.useStream(stream, self.desiredFacing, self.generation);
      }).then(function (ok) {
        var after = self.track ? self.trackInfo(self.track) : { deviceId: "", facingMode: "" };
        var switched = ok && ((after.deviceId && after.deviceId !== oldId) || after.facingMode === "user" || after.facingMode === self.desiredFacing);
        if (!switched) {
          self.facing = previous;
          self.state.facing = previous;
          return self.start().then(function () {
            self.switching = false;
            throw fail("switch");
          });
        }
        self.facing = self.desiredFacing;
        self.state.facing = self.desiredFacing;
        return self.playVideo().then(function () {
          self.switching = false;
          return { facing: self.facing };
        });
      });
    });
  };

  Camera.prototype.switchFacing = function () {
    if (this.switching) return Promise.resolve({ facing: this.facing, ignored: true });
    this.switching = true;
    var self = this;
    var previous = this.facing === "user" ? "user" : "environment";
    var oldId = this.deviceId || "";
    if (this.track) {
      var before = this.trackInfo(this.track);
      if (before.deviceId) oldId = before.deviceId;
    }
    /* v7: gewünschte Seite setzen, dann start(). Davor alte Tracks stoppen. */
    this.facing = previous === "environment" ? "user" : "environment";
    this.desiredFacing = this.facing;
    this.lastError = "";

    return this.releaseHardware().then(function () {
      return self.start();
    }).then(function () {
      return self.playVideo();
    }).then(function () {
      return self.keepOrOther(previous, oldId);
    }).catch(function (err) {
      if (err && err.name) self.lastError = err.name;
      if (err && err.code === "switch") {
        self.switching = false;
        throw err;
      }
      if (err && (err.name === "OverconstrainedError" || err.name === "NotFoundError" || err.name === "NotReadableError" || err.code === "missing")) {
        return self.listCameras().then(function (devices) {
          var plan = SBL.planCameraSwitch({
            desired: self.desiredFacing,
            oldId: oldId,
            gotId: "",
            gotFacing: "",
            errorName: self.lastError,
            devices: devices
          });
          if (plan.action !== "use-device") throw fail("switch");
          return self.releaseHardware().then(function () {
            return self.openById(plan.deviceId);
          });
        }).then(function (stream) {
          return self.useStream(stream, self.desiredFacing, self.generation);
        }).then(function (ok) {
          if (!ok) throw fail("switch");
          self.facing = self.desiredFacing;
          self.state.facing = self.desiredFacing;
          self.switching = false;
          return self.playVideo().then(function () { return { facing: self.facing }; });
        }).catch(function (inner) {
          if (inner && inner.name) self.lastError = inner.name;
          self.facing = previous;
          self.state.facing = previous;
          return self.start().catch(function () {}).then(function () {
            self.switching = false;
            throw fail("switch");
          });
        });
      }
      self.facing = previous;
      self.state.facing = previous;
      return self.start().catch(function () {}).then(function () {
        self.switching = false;
        throw fail("switch");
      });
    });
  };

  SBL.Camera = Camera;
})(window.SBL = window.SBL || {});
