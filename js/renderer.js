/* Zeichnet das Kamerabild (oder die Beispielansicht) mit der gewählten
   Darstellung. WebGL ist schnell genug fürs Livebild; ohne WebGL
   übernimmt ein Canvas-2D-Fallback. */
(function (SBL) {
  "use strict";

  var VERT = [
    "attribute vec2 a_pos;",
    "uniform vec2 u_uvScale;",
    "uniform vec2 u_pan;",
    "uniform float u_flip;",
    "varying vec2 v_uv;",
    "void main() {",
    "  gl_Position = vec4(a_pos.x * 2.0 - 1.0, 1.0 - a_pos.y * 2.0, 0.0, 1.0);",
    "  vec2 uv = (a_pos - 0.5) * u_uvScale + 0.5 + u_pan;",
    "  uv.y = mix(uv.y, 1.0 - uv.y, u_flip);",
    "  v_uv = uv;",
    "}"
  ].join("\n");

  var FRAG = [
    "precision mediump float;",
    "varying vec2 v_uv;",
    "uniform sampler2D u_tex;",
    "uniform sampler2D u_illum;",
    "uniform vec2 u_texel;",
    "uniform float u_kind;",
    "uniform float u_mag;",
    "uniform vec3 u_ink;",
    "uniform vec3 u_paper;",
    "float luma(vec3 c) {",
    "  return dot(c, vec3(0.299, 0.587, 0.114));",
    "}",
    "float paperAmount(float y) {",
    "  float p = smoothstep(0.30, 0.62, y);",
    "  return smoothstep(0.15, 0.85, p);",
    "}",
    "void main() {",
    "  vec2 uv = v_uv;",
    "  if (u_mag > 1.02) {",
    "    vec2 t = max(u_texel, vec2(0.00001));",
    "    uv = (floor(uv / t) + 0.5) * t;",
    "  }",
    "  vec3 c = texture2D(u_tex, uv).rgb;",
    "  if (u_kind < 0.5) {",
    "    gl_FragColor = vec4(c, 1.0);",
    "  } else if (u_kind < 1.5) {",
    "    vec3 h = clamp((c - 0.45) * 2.6 + 0.5, 0.0, 1.0);",
    "    gl_FragColor = vec4(h, 1.0);",
    "  } else if (u_kind < 2.5) {",
    "    gl_FragColor = vec4(1.0 - c, 1.0);",
    "  } else if (u_kind < 3.5) {",
    "    float paper = paperAmount(luma(c));",
    "    gl_FragColor = vec4(mix(u_ink, u_paper, paper), 1.0);",
    "  } else if (u_kind < 4.5) {",
    "    vec2 t = u_texel;",
    "    float tl = luma(texture2D(u_tex, uv + vec2(-t.x, -t.y)).rgb);",
    "    float tc = luma(texture2D(u_tex, uv + vec2(0.0, -t.y)).rgb);",
    "    float tr = luma(texture2D(u_tex, uv + vec2(t.x, -t.y)).rgb);",
    "    float ml = luma(texture2D(u_tex, uv + vec2(-t.x, 0.0)).rgb);",
    "    float mr = luma(texture2D(u_tex, uv + vec2(t.x, 0.0)).rgb);",
    "    float bl = luma(texture2D(u_tex, uv + vec2(-t.x, t.y)).rgb);",
    "    float bc = luma(texture2D(u_tex, uv + vec2(0.0, t.y)).rgb);",
    "    float br = luma(texture2D(u_tex, uv + vec2(t.x, t.y)).rgb);",
    "    float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;",
    "    float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;",
    "    float edge = smoothstep(0.12, 0.42, length(vec2(gx, gy)));",
    "    gl_FragColor = vec4(vec3(edge), 1.0);",
    "  } else if (u_kind < 5.5) {",
    "    vec3 amber = vec3(",
    "      dot(c, vec3(0.58, 0.38, 0.06)) + 0.05,",
    "      dot(c, vec3(0.20, 0.40, 0.04)) + 0.02,",
    "      dot(c, vec3(0.03, 0.05, 0.08))",
    "    );",
    "    gl_FragColor = vec4(clamp(amber, 0.0, 1.0), 1.0);",
    "  } else if (u_kind < 6.5) {",
    "    float g = clamp((luma(c) - 0.42) * 1.85 + 0.48, 0.0, 1.0);",
    "    gl_FragColor = vec4(vec3(g), 1.0);",
    "  } else if (u_kind < 7.5) {",
    "    float L = dot(c, vec3(17.8824, 43.5161, 4.11935));",
    "    float M = dot(c, vec3(3.45565, 27.1554, 3.86714));",
    "    float S = dot(c, vec3(0.0299566, 0.184309, 1.46709));",
    "    float Mp = 0.494207 * L + 1.24827 * S;",
    "    float rp = 0.080944 * L - 0.130504 * Mp + 0.116721 * S;",
    "    float gp = -0.0102485 * L + 0.0540193 * Mp - 0.113615 * S;",
    "    float bp = -0.0003653 * L - 0.0041216 * Mp + 0.693511 * S;",
    "    float er = c.r - rp;",
    "    float eg = c.g - gp;",
    "    float eb = c.b - bp;",
    "    vec3 shifted = vec3(c.r, c.g + 0.7 * er + eg, c.b + 0.7 * er + eb);",
    "    gl_FragColor = vec4(clamp(shifted, 0.0, 1.0), 1.0);",
    "  } else if (u_kind < 8.5) {",
    "    float y = luma(c);",
    "    float paper = smoothstep(0.42, 0.50, y);",
    "    gl_FragColor = vec4(vec3(1.0 - paper), 1.0);",
    "  } else if (u_kind < 11.5) {",
    "    float y = luma(c);",
    "    float localBg = texture2D(u_illum, uv).r;",
    "    float wideBg = (",
    "      texture2D(u_illum, vec2(0.18, 0.22)).r +",
    "      texture2D(u_illum, vec2(0.82, 0.22)).r +",
    "      texture2D(u_illum, vec2(0.50, 0.50)).r +",
    "      texture2D(u_illum, vec2(0.18, 0.78)).r +",
    "      texture2D(u_illum, vec2(0.82, 0.78)).r",
    "    ) * 0.2;",
    "    float gain = clamp(wideBg / max(localBg, 0.20), 0.72, 2.2);",
    "    y = clamp(y * gain, 0.0, 1.0);",
    "    float paper = smoothstep(0.42, 0.50, y);",
    "    gl_FragColor = vec4(vec3(1.0 - paper), 1.0);",
    "  } else if (u_kind < 13.5) {",
    "    float y = luma(c);",
    "    float localBg = texture2D(u_illum, uv).r;",
    "    float wideBg = (",
    "      texture2D(u_illum, vec2(0.18, 0.22)).r +",
    "      texture2D(u_illum, vec2(0.82, 0.22)).r +",
    "      texture2D(u_illum, vec2(0.50, 0.50)).r +",
    "      texture2D(u_illum, vec2(0.18, 0.78)).r +",
    "      texture2D(u_illum, vec2(0.82, 0.78)).r",
    "    ) * 0.2;",
    "    float gain = clamp(wideBg / max(localBg, 0.20), 0.72, 2.2);",
    "    y = clamp(y * gain, 0.0, 1.0);",
    "    float paper = smoothstep(0.42, 0.50, y);",
    "    gl_FragColor = vec4(mix(u_ink, u_paper, paper), 1.0);",
    "  } else if (u_kind < 14.5) {",
    "    float y = luma(c);",
    "    float localBg = texture2D(u_illum, uv).r;",
    "    float wideBg = (",
    "      texture2D(u_illum, vec2(0.18, 0.22)).r +",
    "      texture2D(u_illum, vec2(0.82, 0.22)).r +",
    "      texture2D(u_illum, vec2(0.50, 0.50)).r +",
    "      texture2D(u_illum, vec2(0.18, 0.78)).r +",
    "      texture2D(u_illum, vec2(0.82, 0.78)).r",
    "    ) * 0.2;",
    "    float gain = clamp(wideBg / max(localBg, 0.20), 0.72, 2.2);",
    "    y = clamp(y * gain, 0.0, 1.0);",
    "    vec3 amber = vec3(y * 1.02 + 0.05, y * 0.64 + 0.02, y * 0.16);",
    "    gl_FragColor = vec4(clamp(amber, 0.0, 1.0), 1.0);",
    "  } else {",
    "    float y = luma(c);",
    "    float localBg = texture2D(u_illum, uv).r;",
    "    float wideBg = (",
    "      texture2D(u_illum, vec2(0.18, 0.22)).r +",
    "      texture2D(u_illum, vec2(0.82, 0.22)).r +",
    "      texture2D(u_illum, vec2(0.50, 0.50)).r +",
    "      texture2D(u_illum, vec2(0.18, 0.78)).r +",
    "      texture2D(u_illum, vec2(0.82, 0.78)).r",
    "    ) * 0.2;",
    "    float gain = clamp(wideBg / max(localBg, 0.20), 0.72, 2.2);",
    "    y = clamp(y * gain, 0.0, 1.0);",
    "    gl_FragColor = vec4(vec3(y), 1.0);",
    "  }",
    "}"
  ].join("\n");

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(log || "Shader");
    }
    return shader;
  }

  function coverScale(srcW, srcH, dstW, dstH, zoom) {
    var srcAspect = srcW / srcH;
    var dstAspect = dstW / dstH;
    var scaleX = 1;
    var scaleY = 1;
    if (srcAspect > dstAspect) scaleX = dstAspect / srcAspect;
    else scaleY = srcAspect / dstAspect;
    var z = zoom > 1 ? zoom : 1;
    return [scaleX / z, scaleY / z];
  }

  function sourceSize(source) {
    if (!source) return null;
    if (source instanceof HTMLVideoElement) {
      if (source.readyState < 2 || !source.videoWidth || !source.videoHeight) return null;
      return [source.videoWidth, source.videoHeight];
    }
    if (source.width && source.height) return [source.width, source.height];
    return null;
  }

  SBL.coverScale = coverScale;
  SBL.sourceSize = sourceSize;

  function createGL(canvas) {
    var gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
      failIfMajorPerformanceCaveat: false,
      powerPreference: "high-performance"
    });
    if (!gl) return null;

    var vert = compile(gl, gl.VERTEX_SHADER, VERT);
    var frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    var program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.bindAttribLocation(program, 0, "a_pos");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "Programm");
    }
    gl.useProgram(program);

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0, 1, 0, 0, 1,
      0, 1, 1, 0, 1, 1
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    var loc = {
      uvScale: gl.getUniformLocation(program, "u_uvScale"),
      pan: gl.getUniformLocation(program, "u_pan"),
      flip: gl.getUniformLocation(program, "u_flip"),
      texel: gl.getUniformLocation(program, "u_texel"),
      kind: gl.getUniformLocation(program, "u_kind"),
      ink: gl.getUniformLocation(program, "u_ink"),
      paper: gl.getUniformLocation(program, "u_paper"),
      tex: gl.getUniformLocation(program, "u_tex"),
      illum: gl.getUniformLocation(program, "u_illum"),
      mag: gl.getUniformLocation(program, "u_mag")
    };
    gl.uniform1i(loc.tex, 0);
    gl.uniform1i(loc.illum, 2);
    gl.uniform1f(loc.mag, 1);
    gl.uniform1f(loc.flip, 0);
    gl.uniform2f(loc.pan, 0, 0);
    gl.clearColor(0, 0, 0, 1);

    /* Misst einmal, ob die obere Bildzeile oben ankommt. Chrome und Safari
       legen Videobilder nicht immer gleich in die Textur. */
    function calibrateOrientation() {
      var probe = document.createElement("canvas");
      probe.width = 2;
      probe.height = 2;
      var pctx = probe.getContext("2d");
      pctx.fillStyle = "#ff0000";
      pctx.fillRect(0, 0, 2, 1);
      pctx.fillStyle = "#0000ff";
      pctx.fillRect(0, 1, 2, 1);
      if (canvas.width < 2 || canvas.height < 2) {
        canvas.width = 2;
        canvas.height = 2;
      }
      gl.uniform2f(loc.uvScale, 1, 1);
      gl.uniform1f(loc.kind, 0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, probe);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      var pixel = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      if (pixel[0] + pixel[2] === 0) return;
      /* readPixels-Ursprung ist unten links. Blau unten heißt: aufrecht. */
      var needsFlip = pixel[0] > pixel[2];
      orientationFlip = needsFlip ? 1 : 0;
      gl.uniform1f(loc.flip, orientationFlip);
    }

    var orientationFlip = 0;

    calibrateOrientation();

    var source = null;
    var mode = SBL.MODES[0];
    var magnification = 1;
    var panX = 0;
    var panY = 0;
    var running = false;
    var raf = 0;
    var frameMs = 0;

    function clampPan(scale) {
      var limitX = Math.max(0, (1 - scale[0]) * 0.5);
      var limitY = Math.max(0, (1 - scale[1]) * 0.5);
      if (panX > limitX) panX = limitX;
      if (panX < -limitX) panX = -limitX;
      if (panY > limitY) panY = limitY;
      if (panY < -limitY) panY = -limitY;
    }

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    var ACCUM_VERT = [
      "attribute vec2 a_pos;",
      "varying vec2 v_uv;",
      "void main() {",
      "  gl_Position = vec4(a_pos.x * 2.0 - 1.0, 1.0 - a_pos.y * 2.0, 0.0, 1.0);",
      "  v_uv = vec2(a_pos.x, 1.0 - a_pos.y);",
      "}"
    ].join("\n");
    var ACCUM_FRAG = [
      "precision mediump float;",
      "varying vec2 v_uv;",
      "uniform sampler2D u_curr;",
      "uniform sampler2D u_prev;",
      "uniform float u_alpha;",
      "uniform float u_reset;",
      "uniform float u_ghost;",
      "float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }",
      "void main() {",
      "  float curr = luma(texture2D(u_curr, v_uv).rgb);",
      "  float prev = texture2D(u_prev, v_uv).r;",
      "  if (u_reset > 0.5) {",
      "    gl_FragColor = vec4(curr, curr, curr, 1.0);",
      "    return;",
      "  }",
      "  float gap = abs(curr - prev);",
      "  float a = gap > u_ghost ? 1.0 : u_alpha;",
      "  float m = mix(prev, curr, a);",
      "  gl_FragColor = vec4(m, m, m, 1.0);",
      "}"
    ].join("\n");
    var accumProgram = gl.createProgram();
    gl.attachShader(accumProgram, compile(gl, gl.VERTEX_SHADER, ACCUM_VERT));
    gl.attachShader(accumProgram, compile(gl, gl.FRAGMENT_SHADER, ACCUM_FRAG));
    gl.bindAttribLocation(accumProgram, 0, "a_pos");
    gl.linkProgram(accumProgram);
    var accumLoc = {
      curr: gl.getUniformLocation(accumProgram, "u_curr"),
      prev: gl.getUniformLocation(accumProgram, "u_prev"),
      alpha: gl.getUniformLocation(accumProgram, "u_alpha"),
      reset: gl.getUniformLocation(accumProgram, "u_reset"),
      ghost: gl.getUniformLocation(accumProgram, "u_ghost")
    };
    var accumTex = [gl.createTexture(), gl.createTexture()];
    var accumFbo = [gl.createFramebuffer(), gl.createFramebuffer()];
    var accumW = 0;
    var accumH = 0;
    var accumRead = 0;
    var resetAccum = true;
    var holdAccum = false;
    /* Ruhe vor dem nächsten Mitteln, danach sanft von 1 auf 0,2. */
    var STILL_MS = 320;
    var EASE_MS = 220;
    var ALPHA_STILL = 0.2;
    var GHOST = 0.12;
    var MOTION_HOLD_MS = 80;
    var stillSince = 0;
    var deviceMovedAt = 0;
    var lastGravity = null;
    var lastAlpha = 1;
    var lastReset = true;
    var drawn = 0;
    window.addEventListener("devicemotion", function (event) {
      var moving = false;
      var lin = event.acceleration;
      if (lin && typeof lin.x === "number") {
        var am = Math.sqrt(lin.x * lin.x + lin.y * lin.y + lin.z * lin.z);
        if (am > 0.22) moving = true;
      }
      var grav = event.accelerationIncludingGravity;
      if (grav && typeof grav.x === "number") {
        if (lastGravity) {
          var dx = grav.x - lastGravity.x;
          var dy = grav.y - lastGravity.y;
          var dz = grav.z - lastGravity.z;
          if (Math.sqrt(dx * dx + dy * dy + dz * dz) > 0.16) moving = true;
        }
        lastGravity = { x: grav.x, y: grav.y, z: grav.z };
      }
      var rot = event.rotationRate;
      if (rot && typeof rot.alpha === "number") {
        var rm = Math.abs(rot.alpha) + Math.abs(rot.beta) + Math.abs(rot.gamma);
        if (rm > 8) moving = true;
      }
      if (moving) deviceMovedAt = performance.now();
    });

    function blankTex(tex, w, h) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }

    function ensureAccum(w, h) {
      var maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
      if (w > maxTex) w = maxTex;
      if (h > maxTex) h = maxTex;
      if (w === accumW && h === accumH) return true;
      accumW = w;
      accumH = h;
      var i;
      var ok = true;
      for (i = 0; i < 2; i += 1) {
        blankTex(accumTex[i], w, h);
        gl.bindFramebuffer(gl.FRAMEBUFFER, accumFbo[i]);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, accumTex[i], 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) ok = false;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      resetAccum = true;
      stillSince = 0;
      return ok;
    }

    /* Kein drawImage/getImageData auf dem Kamerabild: das würde auf Android
       die Videobilder anhalten, und das Bild spränge nur noch einmal pro
       Sekunde hinterher. Bewegung im Bild fängt der Shader pro Pixel ab. */
    function accumDecision() {
      var now = performance.now();
      var sensor = deviceMovedAt > 0 && (now - deviceMovedAt) < MOTION_HOLD_MS;
      if (resetAccum || sensor) {
        stillSince = 0;
        lastAlpha = 1;
        lastReset = true;
        return;
      }
      if (!stillSince) stillSince = now;
      var quiet = now - stillSince;
      if (quiet < STILL_MS) {
        lastAlpha = 1;
        lastReset = true;
        return;
      }
      var t = (quiet - STILL_MS) / EASE_MS;
      if (t < 1) {
        lastAlpha = 1 - (1 - ALPHA_STILL) * t;
        lastReset = false;
        return;
      }
      lastAlpha = ALPHA_STILL;
      lastReset = false;
    }

    /* Lichtfeld klein und weich, die Schrift bleibt das volle Graustufenbild. */
    var ILLUM_W = 96;
    var ILLUM_H = 54;
    var DOWN_FRAG = [
      "precision mediump float;",
      "varying vec2 v_uv;",
      "uniform sampler2D u_src;",
      "uniform vec2 u_cell;",
      "void main() {",
      "  vec2 cell = u_cell;",
      "  float s = 0.0;",
      "  for (int j = 0; j < 4; j++) {",
      "    for (int i = 0; i < 4; i++) {",
      "      vec2 o = (vec2(float(i), float(j)) - 1.5) * cell * 0.25;",
      "      s += texture2D(u_src, v_uv + o).r;",
      "    }",
      "  }",
      "  s *= 0.0625;",
      "  gl_FragColor = vec4(s, s, s, 1.0);",
      "}"
    ].join("\n");
    var BLUR_FRAG = [
      "precision mediump float;",
      "varying vec2 v_uv;",
      "uniform sampler2D u_src;",
      "uniform vec2 u_dir;",
      "void main() {",
      "  float s = texture2D(u_src, v_uv).r * 0.28;",
      "  s += texture2D(u_src, v_uv + u_dir * 2.0).r * 0.22;",
      "  s += texture2D(u_src, v_uv - u_dir * 2.0).r * 0.22;",
      "  s += texture2D(u_src, v_uv + u_dir * 4.0).r * 0.10;",
      "  s += texture2D(u_src, v_uv - u_dir * 4.0).r * 0.10;",
      "  s += texture2D(u_src, v_uv + u_dir * 6.0).r * 0.04;",
      "  s += texture2D(u_src, v_uv - u_dir * 6.0).r * 0.04;",
      "  gl_FragColor = vec4(s, s, s, 1.0);",
      "}"
    ].join("\n");
    function makeIllumProgram(frag) {
      var prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, ACCUM_VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag));
      gl.bindAttribLocation(prog, 0, "a_pos");
      gl.linkProgram(prog);
      return prog;
    }
    var downProg = makeIllumProgram(DOWN_FRAG);
    var blurProg = makeIllumProgram(BLUR_FRAG);
    if (!gl.getProgramParameter(downProg, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(downProg) || "Lichtfeld");
    if (!gl.getProgramParameter(blurProg, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(blurProg) || "Lichtfeld");
    var downLoc = {
      src: gl.getUniformLocation(downProg, "u_src"),
      cell: gl.getUniformLocation(downProg, "u_cell")
    };
    var blurLoc = {
      src: gl.getUniformLocation(blurProg, "u_src"),
      dir: gl.getUniformLocation(blurProg, "u_dir")
    };
    function makeIllumTex() {
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, ILLUM_W, ILLUM_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return tex;
    }
    var illumA = makeIllumTex();
    var illumB = makeIllumTex();
    var illumFboA = gl.createFramebuffer();
    var illumFboB = gl.createFramebuffer();
    var illumReady = true;
    function attachIllum(fbo, tex) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) illumReady = false;
    }
    attachIllum(illumFboA, illumA);
    attachIllum(illumFboB, illumB);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    function paintIllum(prog, srcTex, fbo) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, ILLUM_W, ILLUM_H);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function buildIllum(srcTex) {
      if (!illumReady) return false;
      gl.useProgram(downProg);
      gl.uniform1i(downLoc.src, 0);
      gl.uniform2f(downLoc.cell, 1 / ILLUM_W, 1 / ILLUM_H);
      paintIllum(downProg, srcTex, illumFboA);
      gl.useProgram(blurProg);
      gl.uniform1i(blurLoc.src, 0);
      gl.uniform2f(blurLoc.dir, 1 / ILLUM_W, 0);
      paintIllum(blurProg, illumA, illumFboB);
      gl.uniform2f(blurLoc.dir, 0, 1 / ILLUM_H);
      paintIllum(blurProg, illumB, illumFboA);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return true;
    }

    /* Modus 3: lokale Verschiebung der Vorgeschichte auf das aktuelle Bild.
       Nur Translation, ±6 px in 2-px-Schritten, eine Richtung pro Kachel.
       Unsicher, periodisch, bildrandig oder zu groß: aktuelles Bild. */
    var ALIGN_W = 48;
    var ALIGN_H = 27;
    var ALIGN_FRAG = [
      "precision mediump float;",
      "varying vec2 v_uv;",
      "uniform sampler2D u_curr;",
      "uniform sampler2D u_hist;",
      "uniform vec2 u_texel;",
      "uniform float u_reset;",
      "float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }",
      "float currAt(vec2 uv) { return luma(texture2D(u_curr, uv).rgb); }",
      "float histAt(vec2 uv) { return texture2D(u_hist, uv).r; }",
      "void main() {",
      "  if (u_reset > 0.5 || v_uv.x < 0.05 || v_uv.x > 0.95 || v_uv.y < 0.05 || v_uv.y > 0.95) {",
      "    gl_FragColor = vec4(0.5, 0.5, 0.0, 1.0);",
      "    return;",
      "  }",
      "  float mean = 0.0;",
      "  for (int j = -1; j <= 1; j++) {",
      "    for (int i = -1; i <= 1; i++) {",
      "      mean += currAt(v_uv + vec2(float(i), float(j)) * u_texel * 6.0);",
      "    }",
      "  }",
      "  mean /= 9.0;",
      "  float variation = 0.0;",
      "  for (int j = -1; j <= 1; j++) {",
      "    for (int i = -1; i <= 1; i++) {",
      "      float s = currAt(v_uv + vec2(float(i), float(j)) * u_texel * 6.0);",
      "      variation += abs(s - mean);",
      "    }",
      "  }",
      "  variation /= 9.0;",
      "  if (variation < 0.02) {",
      "    gl_FragColor = vec4(0.5, 0.5, 0.45, 1.0);",
      "    return;",
      "  }",
      "  float best = 100.0;",
      "  float second = 100.0;",
      "  float zeroSad = 100.0;",
      "  float bestX = 0.0;",
      "  float bestY = 0.0;",
      "  for (int j = -3; j <= 3; j++) {",
      "    for (int i = -3; i <= 3; i++) {",
      "      vec2 off = vec2(float(i), float(j)) * u_texel * 2.0;",
      "      float sad = 0.0;",
      "      for (int t = -1; t <= 1; t++) {",
      "        for (int s = -1; s <= 1; s++) {",
      "          vec2 p = v_uv + vec2(float(s), float(t)) * u_texel * 5.0;",
      "          sad += abs(currAt(p) - histAt(p + off));",
      "        }",
      "      }",
      "      sad /= 9.0;",
      "      if (i == 0 && j == 0) zeroSad = sad;",
      "      if (sad < best) {",
      "        float far = abs(float(i) - bestX) + abs(float(j) - bestY);",
      "        if (far >= 2.0) second = best;",
      "        best = sad;",
      "        bestX = float(i);",
      "        bestY = float(j);",
      "      } else if (abs(float(i) - bestX) + abs(float(j) - bestY) >= 2.0 && sad < second) {",
      "        second = sad;",
      "      }",
      "    }",
      "  }",
      "  float conf = 1.0;",
      "  float useX = bestX;",
      "  float useY = bestY;",
      "  if (best > 0.09) conf = 0.0;",
      "  if (zeroSad <= best + 0.02) {",
      "    useX = 0.0;",
      "    useY = 0.0;",
      "    conf = best > 0.09 ? 0.0 : 1.0;",
      "  } else if (second - best < 0.012) {",
      "    conf = 0.0;",
      "  }",
      "  gl_FragColor = vec4(useX * 2.0 / 32.0 + 0.5, useY * 2.0 / 32.0 + 0.5, conf, 1.0);",
      "}"
    ].join("\n");
    var FUSE_FRAG = [
      "precision mediump float;",
      "varying vec2 v_uv;",
      "uniform sampler2D u_curr;",
      "uniform sampler2D u_hist;",
      "uniform sampler2D u_motion;",
      "uniform vec2 u_texel;",
      "uniform float u_reset;",
      "float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }",
      "void main() {",
      "  float c = luma(texture2D(u_curr, v_uv).rgb);",
      "  if (u_reset > 0.5) {",
      "    gl_FragColor = vec4(c, c, c, 1.0);",
      "    return;",
      "  }",
      "  vec4 mot = texture2D(u_motion, v_uv);",
      "  if (mot.b < 0.25) {",
      "    gl_FragColor = vec4(c, c, c, 1.0);",
      "    return;",
      "  }",
      "  vec2 off = vec2(0.0);",
      "  if (mot.b > 0.75) off = (mot.xy - 0.5) * 32.0 * u_texel;",
      "  float h = texture2D(u_hist, v_uv + off).r;",
      "  float outc = c;",
      "  if (abs(h - c) <= 0.12) outc = mix(h, c, 0.4);",
      "  gl_FragColor = vec4(outc, outc, outc, 1.0);",
      "}"
    ].join("\n");
    function makePass(frag) {
      var prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, ACCUM_VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag));
      gl.bindAttribLocation(prog, 0, "a_pos");
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(prog) || "Ausrichtung");
      }
      return prog;
    }
    var REFINE_FRAG = [
      "precision mediump float;",
      "varying vec2 v_uv;",
      "uniform sampler2D u_curr;",
      "uniform sampler2D u_hist;",
      "uniform sampler2D u_coarse;",
      "uniform vec2 u_texel;",
      "uniform float u_reset;",
      "float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }",
      "float currAt(vec2 uv) { return luma(texture2D(u_curr, uv).rgb); }",
      "float histAt(vec2 uv) { return texture2D(u_hist, uv).r; }",
      "float sadAt(vec2 off) {",
      "  float sad = 0.0;",
      "  for (int t = -1; t <= 1; t++) {",
      "    for (int s = -1; s <= 1; s++) {",
      "      vec2 p = v_uv + vec2(float(s), float(t)) * u_texel * 5.0;",
      "      sad += abs(currAt(p) - histAt(p + off));",
      "    }",
      "  }",
      "  return sad / 9.0;",
      "}",
      "void main() {",
      "  vec4 coarse = texture2D(u_coarse, v_uv);",
      "  if (u_reset > 0.5 || coarse.b < 0.75) {",
      "    gl_FragColor = coarse;",
      "    return;",
      "  }",
      "  vec2 base = (coarse.xy - 0.5) * 32.0 * u_texel;",
      "  float baseSad = sadAt(base);",
      "  float best = baseSad;",
      "  vec2 bestOff = base;",
      "  float second = 100.0;",
      "  for (int j = -2; j <= 2; j++) {",
      "    for (int i = -2; i <= 2; i++) {",
      "      if (i == 0 && j == 0) {",
      "        best = best;",
      "      } else {",
      "        vec2 off = base + vec2(float(i), float(j)) * u_texel * 0.5;",
      "        float sad = sadAt(off);",
      "        float dist = abs(float(i)) + abs(float(j));",
      "        if (sad < best) {",
      "          if (dist >= 2.0) second = best;",
      "          best = sad;",
      "          bestOff = off;",
      "        } else if (dist >= 2.0 && sad < second) {",
      "          second = sad;",
      "        }",
      "      }",
      "    }",
      "  }",
      "  if (best > baseSad - 0.004 || (second < 90.0 && second - best < 0.006)) {",
      "    gl_FragColor = coarse;",
      "    return;",
      "  }",
      "  vec2 pix = bestOff / u_texel;",
      "  gl_FragColor = vec4(pix.x / 32.0 + 0.5, pix.y / 32.0 + 0.5, coarse.b, 1.0);",
      "}"
    ].join("\n");
    var alignProg = makePass(ALIGN_FRAG);
    var fuseProg = makePass(FUSE_FRAG);
    var refineProg = makePass(REFINE_FRAG);
    var alignLoc = {
      curr: gl.getUniformLocation(alignProg, "u_curr"),
      hist: gl.getUniformLocation(alignProg, "u_hist"),
      texel: gl.getUniformLocation(alignProg, "u_texel"),
      reset: gl.getUniformLocation(alignProg, "u_reset")
    };
    var fuseLoc = {
      curr: gl.getUniformLocation(fuseProg, "u_curr"),
      hist: gl.getUniformLocation(fuseProg, "u_hist"),
      motion: gl.getUniformLocation(fuseProg, "u_motion"),
      texel: gl.getUniformLocation(fuseProg, "u_texel"),
      reset: gl.getUniformLocation(fuseProg, "u_reset")
    };
    var refineLoc = {
      curr: gl.getUniformLocation(refineProg, "u_curr"),
      hist: gl.getUniformLocation(refineProg, "u_hist"),
      coarse: gl.getUniformLocation(refineProg, "u_coarse"),
      texel: gl.getUniformLocation(refineProg, "u_texel"),
      reset: gl.getUniformLocation(refineProg, "u_reset")
    };
    var motionTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, motionTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, ALIGN_W, ALIGN_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    var motionFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, motionFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, motionTex, 0);
    var alignReady = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    var refineTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, refineTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, ALIGN_W, ALIGN_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    var refineFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, refineFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, refineTex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) alignReady = false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    var fuseTex = [gl.createTexture(), gl.createTexture()];
    var fuseFbo = [gl.createFramebuffer(), gl.createFramebuffer()];
    var fuseW = 0;
    var fuseH = 0;
    var fuseRead = 0;
    function blankNearest(tex, w, h) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
    function ensureFuse(w, h) {
      var maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
      if (w > maxTex) w = maxTex;
      if (h > maxTex) h = maxTex;
      if (!alignReady) return false;
      if (w === fuseW && h === fuseH) return true;
      fuseW = w;
      fuseH = h;
      var i;
      for (i = 0; i < 2; i += 1) {
        blankNearest(fuseTex[i], w, h);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fuseFbo[i]);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fuseTex[i], 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) alignReady = false;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      resetAccum = true;
      return alignReady;
    }
    function bindPair(unit, tex) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
    }
    var frameSource = texture;
    var frozenOn = false;
    var frozenTex = gl.createTexture();
    var frozenFbo = gl.createFramebuffer();
    var frozenW = 0;
    var frozenH = 0;
    var copyProg = makePass([
      "precision mediump float;",
      "varying vec2 v_uv;",
      "uniform sampler2D u_src;",
      "void main() { gl_FragColor = texture2D(u_src, v_uv); }"
    ].join("\n"));
    var copyLoc = gl.getUniformLocation(copyProg, "u_src");
    gl.bindTexture(gl.TEXTURE_2D, frozenTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    function captureFreeze(w, h) {
      w = Math.round(w);
      h = Math.round(h);
      if (!w || !h || !alignReady) return false;
      var maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
      if (w > maxTex) w = maxTex;
      if (h > maxTex) h = maxTex;
      if (w !== frozenW || h !== frozenH) {
        gl.bindTexture(gl.TEXTURE_2D, frozenTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, frozenFbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, frozenTex, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          return false;
        }
        frozenW = w;
        frozenH = h;
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, frozenFbo);
      gl.viewport(0, 0, w, h);
      gl.useProgram(copyProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(copyLoc, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.activeTexture(gl.TEXTURE0);
      frozenOn = true;
      return true;
    }

    function releaseFreeze() {
      frozenOn = false;
    }

    function alignFrame(w, h, fine) {
      var hist = fuseTex[fuseRead];
      var write = 1 - fuseRead;
      gl.bindFramebuffer(gl.FRAMEBUFFER, motionFbo);
      gl.viewport(0, 0, ALIGN_W, ALIGN_H);
      gl.useProgram(alignProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      bindPair(0, frameSource);
      bindPair(1, hist);
      gl.uniform1i(alignLoc.curr, 0);
      gl.uniform1i(alignLoc.hist, 1);
      gl.uniform2f(alignLoc.texel, 1 / w, 1 / h);
      gl.uniform1f(alignLoc.reset, resetAccum ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      var motionSrc = motionTex;
      if (fine) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, refineFbo);
        gl.viewport(0, 0, ALIGN_W, ALIGN_H);
        gl.useProgram(refineProg);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        bindPair(0, frameSource);
        bindPair(1, hist);
        bindPair(2, motionTex);
        gl.uniform1i(refineLoc.curr, 0);
        gl.uniform1i(refineLoc.hist, 1);
        gl.uniform1i(refineLoc.coarse, 2);
        gl.uniform2f(refineLoc.texel, 1 / w, 1 / h);
        gl.uniform1f(refineLoc.reset, resetAccum ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        motionSrc = refineTex;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fuseFbo[write]);
      gl.viewport(0, 0, w, h);
      gl.useProgram(fuseProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      bindPair(0, frameSource);
      bindPair(1, hist);
      bindPair(2, motionSrc);
      gl.uniform1i(fuseLoc.curr, 0);
      gl.uniform1i(fuseLoc.hist, 1);
      gl.uniform1i(fuseLoc.motion, 2);
      gl.uniform2f(fuseLoc.texel, 1 / w, 1 / h);
      gl.uniform1f(fuseLoc.reset, resetAccum ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.activeTexture(gl.TEXTURE0);
      fuseRead = write;
      resetAccum = false;
    }

    function draw() {
      drawn += 1;
      resize();
      /* canvas.width setzt in manchen Browsern den GL-Zustand zurück. */
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      var size = sourceSize(source);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!size) return;
      frameSource = texture;
      if (frozenOn && frozenTex && frozenW === size[0] && frozenH === size[1]) {
        frameSource = frozenTex;
      } else {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        frameSource = texture;
      }
      gl.bindTexture(gl.TEXTURE_2D, frameSource);
      gl.uniform1f(loc.flip, orientationFlip);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      var scale = coverScale(size[0], size[1], canvas.width, canvas.height, magnification);
      clampPan(scale);
      gl.uniform2f(loc.uvScale, scale[0], scale[1]);
      gl.uniform2f(loc.pan, panX, panY);
      gl.uniform2f(loc.texel, 1 / size[0], 1 / size[1]);
      var drawKind = mode.kind;
      var shownKind = drawKind;
      var useAccum = drawKind === SBL.KIND.smooth || drawKind === SBL.KIND.smooth2;
      if (useAccum && ensureAccum(size[0], size[1])) {
        var write = 1 - accumRead;
        if (!holdAccum) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, accumFbo[write]);
          gl.viewport(0, 0, accumW, accumH);
          gl.useProgram(accumProgram);
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          gl.enableVertexAttribArray(0);
          gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frameSource);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, accumTex[accumRead]);
          accumDecision();
          gl.uniform1i(accumLoc.curr, 0);
          gl.uniform1i(accumLoc.prev, 1);
          gl.uniform1f(accumLoc.alpha, lastAlpha);
          gl.uniform1f(accumLoc.reset, lastReset ? 1 : 0);
          gl.uniform1f(accumLoc.ghost, GHOST);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          accumRead = write;
          resetAccum = false;
        }
        var illumOn = drawKind === SBL.KIND.smooth2 && buildIllum(accumTex[accumRead]);
        if (!illumOn && drawKind === SBL.KIND.smooth2) shownKind = SBL.KIND.smooth;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, accumTex[accumRead]);
        if (illumOn) {
          gl.activeTexture(gl.TEXTURE2);
          gl.bindTexture(gl.TEXTURE_2D, illumA);
          gl.activeTexture(gl.TEXTURE0);
        }
        gl.uniform1f(loc.flip, orientationFlip);
        gl.uniform2f(loc.uvScale, scale[0], scale[1]);
        gl.uniform2f(loc.pan, panX, panY);
        gl.uniform2f(loc.texel, 1 / size[0], 1 / size[1]);
      } else if (drawKind === SBL.KIND.smooth2) {
        shownKind = SBL.KIND.smooth;
      } else if ((drawKind === SBL.KIND.smooth3 || drawKind === SBL.KIND.smooth4 || drawKind === SBL.KIND.smoothBw || drawKind === SBL.KIND.smoothYb || drawKind === SBL.KIND.smoothAmber || drawKind === SBL.KIND.smoothGray) && ensureFuse(size[0], size[1])) {
        if (!holdAccum) alignFrame(fuseW, fuseH, drawKind === SBL.KIND.smooth4);
        var illumAlign = buildIllum(fuseTex[fuseRead]);
        if (drawKind === SBL.KIND.smooth3 || drawKind === SBL.KIND.smooth4) {
          shownKind = illumAlign ? SBL.KIND.smooth2 : SBL.KIND.smooth;
        } else if (illumAlign) {
          shownKind = drawKind;
        } else if (drawKind === SBL.KIND.smoothAmber) {
          shownKind = SBL.KIND.amber;
        } else if (drawKind === SBL.KIND.smoothGray) {
          shownKind = SBL.KIND.gray;
        } else {
          shownKind = SBL.KIND.smooth;
        }
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fuseTex[fuseRead]);
        if (illumAlign) {
          gl.activeTexture(gl.TEXTURE2);
          gl.bindTexture(gl.TEXTURE_2D, illumA);
          gl.activeTexture(gl.TEXTURE0);
        }
        gl.uniform1f(loc.flip, orientationFlip);
        gl.uniform2f(loc.uvScale, scale[0], scale[1]);
        gl.uniform2f(loc.pan, panX, panY);
        gl.uniform2f(loc.texel, 1 / size[0], 1 / size[1]);
      } else if (drawKind === SBL.KIND.smooth3 || drawKind === SBL.KIND.smooth4 || drawKind === SBL.KIND.smoothBw || drawKind === SBL.KIND.smoothYb) {
        shownKind = SBL.KIND.smooth;
      } else if (drawKind === SBL.KIND.smoothAmber) {
        shownKind = SBL.KIND.amber;
      } else if (drawKind === SBL.KIND.smoothGray) {
        shownKind = SBL.KIND.gray;
      }
      gl.uniform1f(loc.mag, magnification);
      gl.uniform1f(loc.kind, shownKind);
      gl.uniform3fv(loc.ink, mode.ink || [0, 0, 0]);
      gl.uniform3fv(loc.paper, mode.paper || [1, 1, 1]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    var warned = false;
    function frame() {
      if (!running) return;
      var t0 = performance.now();
      try {
        draw();
      } catch (err) {
        if (!warned) {
          warned = true;
          console.warn("Bildaufbau fehlgeschlagen", err);
        }
      }
      var ms = performance.now() - t0;
      frameMs = frameMs ? frameMs * 0.8 + ms * 0.2 : ms;
      raf = requestAnimationFrame(frame);
    }

    canvas.addEventListener("webglcontextlost", function (event) {
      event.preventDefault();
      running = false;
      cancelAnimationFrame(raf);
    });

    return {
      backend: "webgl",
      frameMs: function () { return frameMs; },
      orientationFlip: function () { return orientationFlip; },
      holdSmooth: function (on) { holdAccum = !!on; },
      captureFreeze: captureFreeze,
      releaseFreeze: releaseFreeze,
      freezeInfo: function () { return { on: frozenOn, width: frozenW, height: frozenH }; },
      resetSmooth: function () { if (!holdAccum) resetAccum = true; },
      smoothDebug: function () {
        return {
          alpha: lastAlpha,
          reset: lastReset,
          stillMs: STILL_MS,
          easeMs: EASE_MS,
          alphaStill: ALPHA_STILL,
          ghost: GHOST,
          frames: drawn
        };
      },
      setSource: function (next) {
        source = next;
        if (!holdAccum) resetAccum = true;
      },
      setMode: function (next) {
        var incoming = next || SBL.MODES[0];
        if (!mode || incoming.kind !== mode.kind) resetAccum = true;
        mode = incoming;
      },
      setMagnification: function (value) {
        var next = value > 1 ? value : 1;
        if (next !== magnification) resetAccum = true;
        magnification = next;
      },
      setPan: function (x, y) {
        var nx = x || 0;
        var ny = y || 0;
        if (!holdAccum && (nx !== panX || ny !== panY)) resetAccum = true;
        panX = nx;
        panY = ny;
      },
      panBy: function (dx, dy, viewW, viewH) {
        if (!holdAccum) resetAccum = true;
        var size = sourceSize(source);
        if (!size || !viewW || !viewH) return;
        var scale = coverScale(size[0], size[1], canvas.width || viewW, canvas.height || viewH, magnification);
        var ySign = orientationFlip ? -1 : 1;
        panX -= (dx / viewW) * scale[0];
        panY -= ySign * (dy / viewH) * scale[1];
        clampPan(scale);
      },
      viewToSource: function (nx, ny) {
        var size = sourceSize(source);
        if (!size) return { x: nx, y: ny };
        var scale = coverScale(size[0], size[1], canvas.width || 1, canvas.height || 1, magnification);
        var x = (nx - 0.5) * scale[0] + 0.5 + panX;
        var y = (ny - 0.5) * scale[1] + 0.5 + panY;
        if (orientationFlip) y = 1.0 - y;
        if (x < 0) x = 0;
        if (x > 1) x = 1;
        if (y < 0) y = 0;
        if (y > 1) y = 1;
        return { x: x, y: y };
      },
      start: function () {
        if (running) return;
        running = true;
        raf = requestAnimationFrame(frame);
      },
      stop: function () {
        running = false;
        cancelAnimationFrame(raf);
      },
      drawNow: draw
    };
  }

  function create2D(canvas) {
    var ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    var work = document.createElement("canvas");
    var wctx = work.getContext("2d", { willReadFrequently: true });
    var source = null;
    var mode = SBL.MODES[0];
    var magnification = 1;
    var panX = 0;
    var panY = 0;
    var running = false;
    var raf = 0;
    var frameMs = 0;
    var maxWidth = 720;

    function clampPan(scale) {
      var limitX = Math.max(0, (1 - scale[0]) * 0.5);
      var limitY = Math.max(0, (1 - scale[1]) * 0.5);
      if (panX > limitX) panX = limitX;
      if (panX < -limitX) panX = -limitX;
      if (panY > limitY) panY = limitY;
      if (panY < -limitY) panY = -limitY;
    }

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    function paintCover(targetCtx, targetW, targetH, src, size) {
      var zoom = magnification > 1 ? magnification : 1;
      var dstAspect = targetW / targetH;
      var srcAspect = size[0] / size[1];
      var sw;
      var sh;
      if (srcAspect > dstAspect) {
        sh = size[1];
        sw = size[1] * dstAspect;
      } else {
        sw = size[0];
        sh = size[0] / dstAspect;
      }
      sw /= zoom;
      sh /= zoom;
      var sx = (size[0] - sw) / 2 + panX * size[0];
      var sy = (size[1] - sh) / 2 + panY * size[1];
      if (sx < 0) sx = 0;
      if (sy < 0) sy = 0;
      if (sx + sw > size[0]) sx = Math.max(0, size[0] - sw);
      if (sy + sh > size[1]) sy = Math.max(0, size[1] - sh);
      targetCtx.imageSmoothingEnabled = zoom <= 1.02;
      targetCtx.drawImage(src, sx, sy, sw, sh, 0, 0, targetW, targetH);
    }

    function shadeSmooth2(data, width, height) {
      var cols = 12;
      var rows = 8;
      var sum = new Float32Array(cols * rows);
      var count = new Float32Array(cols * rows);
      var y;
      var x;
      for (y = 0; y < height; y += 1) {
        var gy = Math.min(rows - 1, Math.floor(y * rows / height));
        for (x = 0; x < width; x += 1) {
          var gx = Math.min(cols - 1, Math.floor(x * cols / width));
          var p = (y * width + x) * 4;
          var luma = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255;
          var idx = gy * cols + gx;
          sum[idx] += luma;
          count[idx] += 1;
        }
      }
      var grid = new Float32Array(cols * rows);
      var i;
      for (i = 0; i < grid.length; i += 1) grid[i] = count[i] ? sum[i] / count[i] : 0.7;
      var blur = new Float32Array(grid.length);
      var r;
      var c;
      for (r = 0; r < rows; r += 1) {
        for (c = 0; c < cols; c += 1) {
          var acc = 0;
          var n = 0;
          var rr;
          var cc;
          for (rr = r - 1; rr <= r + 1; rr += 1) {
            for (cc = c - 1; cc <= c + 1; cc += 1) {
              if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
              acc += grid[rr * cols + cc];
              n += 1;
            }
          }
          blur[r * cols + c] = acc / n;
        }
      }
      var wide = 0;
      for (i = 0; i < blur.length; i += 1) wide += blur[i];
      wide /= blur.length;
      for (y = 0; y < height; y += 1) {
        var gy2 = Math.min(rows - 1, Math.floor(y * rows / height));
        for (x = 0; x < width; x += 1) {
          var gx2 = Math.min(cols - 1, Math.floor(x * cols / width));
          var q = (y * width + x) * 4;
          var y0 = (0.299 * data[q] + 0.587 * data[q + 1] + 0.114 * data[q + 2]) / 255;
          var local = blur[gy2 * cols + gx2];
          var gain = wide / Math.max(local, 0.2);
          if (gain < 0.72) gain = 0.72;
          if (gain > 2.2) gain = 2.2;
          var y2 = y0 * gain;
          if (y2 < 0) y2 = 0;
          if (y2 > 1) y2 = 1;
          var ps = smoothstep(0.42, 0.50, y2);
          var vs = (1 - ps) * 255;
          data[q] = vs;
          data[q + 1] = vs;
          data[q + 2] = vs;
        }
      }
    }

    function applyPixels(image, width, height, current) {
      var data = image.data;
      var kind = current.kind;
      if (kind === SBL.KIND.normal) return;
      if (kind === SBL.KIND.edges) {
        applyEdges(data, width, height);
        return;
      }
      if (kind === SBL.KIND.smoothAmber) {
        kind = SBL.KIND.amber;
      } else if (kind === SBL.KIND.smoothGray) {
        kind = SBL.KIND.gray;
      } else if (kind === SBL.KIND.smoothBw || kind === SBL.KIND.smoothYb) {
        shadeSmooth2(data, width, height);
        var ink = current.ink || [0, 0, 0];
        var paper = current.paper || [1, 1, 1];
        var p;
        for (p = 0; p < data.length; p += 4) {
          var mix = data[p] / 255;
          data[p] = (ink[0] + (paper[0] - ink[0]) * (1 - mix)) * 255;
          data[p + 1] = (ink[1] + (paper[1] - ink[1]) * (1 - mix)) * 255;
          data[p + 2] = (ink[2] + (paper[2] - ink[2]) * (1 - mix)) * 255;
        }
        return;
      }
      if (kind === SBL.KIND.smooth2 || kind === SBL.KIND.smooth3 || kind === SBL.KIND.smooth4) {
        shadeSmooth2(data, width, height);
        return;
      }
      var ink = current.ink || [0, 0, 0];
      var paper = current.paper || [1, 1, 1];
      for (var i = 0; i < data.length; i += 4) {
        var r = data[i];
        var g = data[i + 1];
        var b = data[i + 2];
        if (kind === SBL.KIND.invert) {
          data[i] = 255 - r;
          data[i + 1] = 255 - g;
          data[i + 2] = 255 - b;
          continue;
        }
        if (kind === SBL.KIND.contrast) {
          data[i] = clampByte((r / 255 - 0.45) * 2.6 + 0.5);
          data[i + 1] = clampByte((g / 255 - 0.45) * 2.6 + 0.5);
          data[i + 2] = clampByte((b / 255 - 0.45) * 2.6 + 0.5);
          continue;
        }
        if (kind === SBL.KIND.amber) {
          var rr = r / 255;
          var gg = g / 255;
          var bb = b / 255;
          data[i] = clampByte(0.58 * rr + 0.38 * gg + 0.06 * bb + 0.05);
          data[i + 1] = clampByte(0.20 * rr + 0.40 * gg + 0.04 * bb + 0.02);
          data[i + 2] = clampByte(0.03 * rr + 0.05 * gg + 0.08 * bb);
          continue;
        }
        if (kind === SBL.KIND.gray) {
          var luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          var gray = clampByte((luma - 0.42) * 1.85 + 0.48);
          data[i] = data[i + 1] = data[i + 2] = gray;
          continue;
        }
        if (kind === SBL.KIND.smooth) {
          var ys = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          var ps = smoothstep(0.42, 0.50, ys);
          var vs = (1 - ps) * 255;
          data[i] = vs;
          data[i + 1] = vs;
          data[i + 2] = vs;
          continue;
        }
        if (kind === SBL.KIND.dalton) {
          var cr = r / 255;
          var cg = g / 255;
          var cb = b / 255;
          var L = 17.8824 * cr + 43.5161 * cg + 4.11935 * cb;
          var Mp = 0.494207 * L + 1.24827 * (0.0299566 * cr + 0.184309 * cg + 1.46709 * cb);
          var S = 0.0299566 * cr + 0.184309 * cg + 1.46709 * cb;
          var rp = 0.080944 * L - 0.130504 * Mp + 0.116721 * S;
          var gp = -0.0102485 * L + 0.0540193 * Mp - 0.113615 * S;
          var bp = -0.0003653 * L - 0.0041216 * Mp + 0.693511 * S;
          var er = cr - rp;
          var eg = cg - gp;
          var eb = cb - bp;
          data[i] = clampByte(cr);
          data[i + 1] = clampByte(cg + 0.7 * er + eg);
          data[i + 2] = clampByte(cb + 0.7 * er + eb);
          continue;
        }
        var y = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        var p = smoothstep(0.30, 0.62, y);
        p = smoothstep(0.15, 0.85, p);
        data[i] = (ink[0] + (paper[0] - ink[0]) * p) * 255;
        data[i + 1] = (ink[1] + (paper[1] - ink[1]) * p) * 255;
        data[i + 2] = (ink[2] + (paper[2] - ink[2]) * p) * 255;
      }
    }

    function draw() {
      resize();
      var size = sourceSize(source);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (!size) return;
      if (mode.kind === SBL.KIND.normal) {
        paintCover(ctx, canvas.width, canvas.height, source, size);
        return;
      }
      var workW = Math.min(maxWidth, canvas.width);
      var workH = Math.max(1, Math.round(workW * (canvas.height / canvas.width)));
      if (work.width !== workW || work.height !== workH) {
        work.width = workW;
        work.height = workH;
      }
      paintCover(wctx, workW, workH, source, size);
      var image = wctx.getImageData(0, 0, workW, workH);
      applyPixels(image, workW, workH, mode);
      wctx.putImageData(image, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(work, 0, 0, canvas.width, canvas.height);
    }

    function frame() {
      if (!running) return;
      var t0 = performance.now();
      draw();
      var ms = performance.now() - t0;
      frameMs = frameMs ? frameMs * 0.8 + ms * 0.2 : ms;
      raf = requestAnimationFrame(frame);
    }

    return {
      backend: "2d",
      frameMs: function () { return frameMs; },
      setSource: function (next) { source = next; },
      setMode: function (next) { mode = next || SBL.MODES[0]; },
      setMagnification: function (value) { magnification = value > 1 ? value : 1; },
      setPan: function (x, y) { panX = x || 0; panY = y || 0; },
      panBy: function (dx, dy, viewW, viewH) {
        var size = sourceSize(source);
        if (!size || !viewW || !viewH) return;
        var scale = coverScale(size[0], size[1], canvas.width || viewW, canvas.height || viewH, magnification);
        panX -= (dx / viewW) * scale[0];
        panY -= (dy / viewH) * scale[1];
        clampPan(scale);
      },
      viewToSource: function (nx, ny) {
        var size = sourceSize(source);
        if (!size) return { x: nx, y: ny };
        var scale = coverScale(size[0], size[1], canvas.width || 1, canvas.height || 1, magnification);
        var x = (nx - 0.5) * scale[0] + 0.5 + panX;
        var y = (ny - 0.5) * scale[1] + 0.5 + panY;
        if (x < 0) x = 0;
        if (x > 1) x = 1;
        if (y < 0) y = 0;
        if (y > 1) y = 1;
        return { x: x, y: y };
      },
      start: function () {
        if (running) return;
        running = true;
        raf = requestAnimationFrame(frame);
      },
      stop: function () {
        running = false;
        cancelAnimationFrame(raf);
      },
      drawNow: draw
    };
  }

  function smoothstep(edge0, edge1, x) {
    var t = (x - edge0) / (edge1 - edge0);
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return t * t * (3 - 2 * t);
  }

  function clampByte(value) {
    var v = Math.round(value * 255);
    if (v < 0) return 0;
    if (v > 255) return 255;
    return v;
  }

  function applyEdges(data, width, height) {
    var gray = new Uint8ClampedArray(width * height);
    var i;
    for (i = 0; i < width * height; i += 1) {
      var o = i * 4;
      gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
    }
    for (var y = 1; y < height - 1; y += 1) {
      for (var x = 1; x < width - 1; x += 1) {
        var idx = y * width + x;
        var gx = -gray[idx - width - 1] - 2 * gray[idx - 1] - gray[idx + width - 1]
          + gray[idx - width + 1] + 2 * gray[idx + 1] + gray[idx + width + 1];
        var gy = -gray[idx - width - 1] - 2 * gray[idx - width] - gray[idx - width + 1]
          + gray[idx + width - 1] + 2 * gray[idx + width] + gray[idx + width + 1];
        var mag = Math.sqrt(gx * gx + gy * gy);
        var val = mag > 80 ? 255 : 0;
        var p = idx * 4;
        data[p] = val;
        data[p + 1] = val;
        data[p + 2] = val;
      }
    }
  }

  SBL.createRenderer = function (canvas) {
    try {
      var glRenderer = createGL(canvas);
      if (glRenderer) return glRenderer;
    } catch (err) {
      var lose = canvas.getContext("webgl");
      if (lose) {
        var ext = lose.getExtension("WEBGL_lose_context");
        if (ext) ext.loseContext();
      }
      var replacement = document.createElement("canvas");
      replacement.id = canvas.id;
      canvas.replaceWith(replacement);
      canvas = replacement;
    }
    return create2D(canvas);
  };
})(window.SBL = window.SBL || {});
