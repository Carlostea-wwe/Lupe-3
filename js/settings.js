/* Gespeicherte Einstellungen. localStorage-Fehler bleiben folgenlos. */
(function (SBL) {
  "use strict";

  var KEY = "sblupe-settings";

  function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function defaults() {
    var modes = {};
    var i;
    var offByDefault = { "red-green": true, "black-lightgreen": true, "black-lightblue": true };
    for (i = 0; i < SBL.MODES.length; i += 1) {
      var modeId = SBL.MODES[i].id;
      modes[modeId] = offByDefault[modeId] ? false : true;
    }
    return {
      modes: modes,
      readingGuide: false,
      guideSize: "mittel",
      guideOffset: 0.5,
      brightness: 100,
      contrast: 100,
      remember: false,
      tapFocus: false,
      rotate: "follow",
      textSize: "normal"
    };
  }

  SBL.textScale = function (size) {
    if (size === "gross") return 1.25;
    if (size === "sehr-gross") return 1.5;
    return 1;
  };

  /* Seitenzoom von Chrome (Standard-Zoom) lässt sich nicht zuverlässig von
     der Geräteauflösung trennen. visualViewport.scale ist nur der Pinch-Zoom.
     screen.width und innerWidth sind beide CSS-Pixel und bleiben auf dem
     Handy etwa gleich. Deshalb bleibt der Faktor 1, außer die Messung ist
     eindeutig — was sie hier nicht ist. */
  SBL.pageZoomInfo = function (metrics) {
    var info = { factor: 1, reliable: false, kind: "none" };
    if (!metrics) return info;
    if (metrics.ios) {
      info.kind = "ios";
      return info;
    }
    if (!metrics.androidChrome) {
      info.kind = "desktop";
      return info;
    }
    var scale = metrics.vvScale;
    if (typeof scale === "number" && scale > 1.02) {
      info.kind = "pinch";
      return info;
    }
    var inner = metrics.innerWidth;
    var screenW = metrics.screenWidth;
    var view = metrics.vvWidth || inner;
    if (!(inner > 0) || !(screenW > 0) || !(view > 0)) return info;
    var ratio = screenW / inner;
    var viewRatio = screenW / view;
    if (Math.abs(ratio - viewRatio) > 0.08) {
      info.kind = "mismatch";
      return info;
    }
    if (ratio > 1.05 && ratio < 3) {
      info.kind = "ambiguous";
      return info;
    }
    if (ratio >= 0.95 && ratio <= 1.05) {
      info.kind = "matched";
      info.reliable = true;
      info.factor = 1;
      return info;
    }
    return info;
  };

  SBL.sliderGesture = function (dx, dy, sliding) {
    if (sliding) return "slide";
    if (Math.abs(dx) <= 10 && Math.abs(dy) <= 10) return "wait";
    if (Math.abs(dx) > 10 && Math.abs(dx) > 1.5 * Math.abs(dy)) return "slide";
    return "scroll";
  };

  SBL.sliderValueAt = function (clientX, left, width, min, max) {
    var span = width > 0 ? width : 1;
    var t = (clientX - left) / span;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return min + t * (max - min);
  };

  SBL.wantsPortraitLock = function (rotate, readingGuide) {
    if (rotate === "lock") return true;
    if (rotate === "guide") return !readingGuide;
    return false;
  };

  /* Einblendung nur, wenn die Sperre gewollt ist, das Bild quer liegt,
     die Sperre nicht gegriffen hat, und diese Querlage noch nicht gemeldet wurde. */
  SBL.rotateHintNeeded = function (state) {
    if (!state || !state.wantsLock || !state.landscape || state.locked || state.alreadyHinted) return false;
    return true;
  };

  SBL.devicePlatform = function (ua, maxTouch, platformName) {
    var text = ua || "";
    var ios = /iPad|iPhone|iPod/.test(text) || (platformName === "MacIntel" && maxTouch > 1);
    if (ios) return "ios";
    if (/SamsungBrowser/i.test(text)) return "samsung";
    if (/Android/i.test(text) && /Chrome|CriOS/i.test(text) && !/Edg|OPR|SamsungBrowser|Firefox/i.test(text)) {
      return "android-chrome";
    }
    if (/Android/i.test(text)) return "android";
    return "other";
  };

  SBL.rotateLockHint = function (platform) {
    if (platform === "ios") return "Bitte Drehsperre im Kontrollzentrum nutzen";
    return "Bitte Drehsperre am Handy nutzen";
  };

  SBL.installCopy = function (platform) {
    if (platform === "ios") {
      return "Tipp: Über Teilen → „Zum Home-Bildschirm“ läuft die Lupe im Vollbild. Die Schriftgröße können Sie danach in der App unter Einstellungen anpassen.";
    }
    if (platform === "samsung") {
      return "Tipp: Stellen Sie vorher die Textgröße im Browser auf Standard. Dann über das Menü → „Seite hinzufügen zu“ → „Startbildschirm“ – so läuft die Lupe im Vollbild in normaler Größe. Die Schriftgröße können Sie danach in der App unter Einstellungen anpassen.";
    }
    if (platform === "android-chrome") {
      return "Tipp: Stellen Sie vorher im Chrome-Menü ⋮ den Zoom auf 100 %. Dann über ⋮ → „App installieren“ – so läuft die Lupe im Vollbild in normaler Größe. Die Schriftgröße können Sie danach in der App unter Einstellungen anpassen.";
    }
    return "Tipp: Fügen Sie die Seite über das Browser-Menü zum Startbildschirm hinzu – so läuft die Lupe im Vollbild. Die Schriftgröße können Sie danach in der App unter Einstellungen anpassen.";
  };

  SBL.guideFraction = function (size) {
    if (size === "klein") return 0.15;
    if (size === "gross") return 0.4;
    return 0.26;
  };

  SBL.clampGuide = function (center, size) {
    var height = SBL.guideFraction(size);
    var min = height / 2;
    var max = 1 - height / 2;
    var value = typeof center === "number" && isFinite(center) ? center : 0.5;
    if (value < min) return min;
    if (value > max) return max;
    return value;
  };

  SBL.nudgeGuide = function (center, size, direction) {
    var step = direction < 0 ? -1 : 1;
    return SBL.clampGuide(center + step * SBL.guideFraction(size), size);
  };

  /* center, freeTop and freeBottom are fractions of the view height.
     The band and the handle share one center and must both stay inside. */
  SBL.clampGuideInView = function (center, bandFraction, freeTop, freeBottom, handleFraction) {
    var band = bandFraction > 0 ? bandFraction : 0;
    var handle = handleFraction > 0 ? handleFraction : 0;
    var span = Math.max(band, handle);
    var topBound = freeTop > 0 ? freeTop : 0;
    var bottomBound = typeof freeBottom === "number" && isFinite(freeBottom) ? freeBottom : 1;
    if (topBound > 1) topBound = 0;
    if (bottomBound > 1) bottomBound = 1;
    if (bottomBound < topBound) bottomBound = topBound;
    var min = topBound + span / 2;
    var max = bottomBound - span / 2;
    var value = typeof center === "number" && isFinite(center) ? center : (topBound + bottomBound) / 2;
    if (value < min) value = min;
    if (value > max) value = max;
    return value;
  };

  SBL.loadSettings = function () {
    var settings = defaults();
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (err) { return settings; }
    if (!raw) return settings;
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return settings;
      if (parsed.modes && typeof parsed.modes === "object") {
        var j;
        for (j = 0; j < SBL.MODES.length; j += 1) {
          var id = SBL.MODES[j].id;
          if (id !== "normal" && typeof parsed.modes[id] === "boolean") {
            settings.modes[id] = parsed.modes[id];
          }
        }
        /* Neue Glatt-Modi gab es im alten Speicher nicht. Ohne eigenen Haken
           folgen sie dem Ausgangsmodus, sonst tauchen sie im Durchschalten
           neben einem anderen Modus auf. */
        var followParent = {
          "black-white-smooth": "black-white",
          "yellow-blue-smooth": "yellow-blue",
          "amber-smooth": "amber",
          "gray-smooth": "gray"
        };
        var childId;
        for (childId in followParent) {
          if (!Object.prototype.hasOwnProperty.call(followParent, childId)) continue;
          var parentId = followParent[childId];
          if (typeof parsed.modes[childId] !== "boolean" && typeof parsed.modes[parentId] === "boolean") {
            settings.modes[childId] = parsed.modes[parentId];
          }
        }
      }
      if (parsed.guideSize === "klein" || parsed.guideSize === "mittel" || parsed.guideSize === "gross") {
        settings.guideSize = parsed.guideSize;
      }
      if (typeof parsed.remember === "boolean") settings.remember = parsed.remember;
      if (typeof parsed.tapFocus === "boolean") settings.tapFocus = parsed.tapFocus;
      if (parsed.rotate === "follow" || parsed.rotate === "guide" || parsed.rotate === "lock") {
        settings.rotate = parsed.rotate;
      }
      if (parsed.textSize === "normal" || parsed.textSize === "gross" || parsed.textSize === "sehr-gross") {
        settings.textSize = parsed.textSize;
      }
      if (settings.remember) {
        if (typeof parsed.readingGuide === "boolean") settings.readingGuide = parsed.readingGuide;
        if (typeof parsed.brightness === "number" && isFinite(parsed.brightness)) {
          settings.brightness = clamp(Math.round(parsed.brightness), 40, 180);
        }
        if (typeof parsed.contrast === "number" && isFinite(parsed.contrast)) {
          settings.contrast = clamp(Math.round(parsed.contrast), 40, 200);
        }
        if (typeof parsed.guideOffset === "number" && isFinite(parsed.guideOffset)) {
          settings.guideOffset = parsed.guideOffset;
        }
      }
      settings.guideOffset = SBL.clampGuide(settings.guideOffset, settings.guideSize);
    } catch (err) { /* beschädigte Daten ignorieren */ }
    settings.modes.normal = true;
    return settings;
  };

  SBL.saveSettings = function (settings) {
    try {
      settings.modes.normal = true;
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch (err) { /* privatmodus */ }
  };

  SBL.enabledModes = function (settings) {
    var list = [];
    var i;
    for (i = 0; i < SBL.MODES.length; i += 1) {
      var mode = SBL.MODES[i];
      if (mode.id === "normal" || (settings.modes && settings.modes[mode.id] !== false)) list.push(mode);
    }
    return list;
  };
})(window.SBL = window.SBL || {});
