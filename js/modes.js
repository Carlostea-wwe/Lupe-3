/* Darstellungsarten der Lupe.
   ink = Farbe der dunklen Schrift, paper = Farbe des hellen Papiers.
   Farbwerte 0..1, damit WebGL und Canvas dieselbe Tabelle nutzen. */
(function (SBL) {
  "use strict";

  SBL.KIND = {
    normal: 0,
    contrast: 1,
    invert: 2,
    duotone: 3,
    edges: 4,
    amber: 5,
    gray: 6,
    dalton: 7,
    smooth: 8,
    smooth2: 9,
    smooth3: 10,
    smooth4: 11,
    smoothBw: 12,
    smoothYb: 13,
    smoothAmber: 14,
    smoothGray: 15
  };

  function duo(id, label, ink, paper) {
    return {
      id: id,
      label: label,
      kind: SBL.KIND.duotone,
      ink: ink,
      paper: paper
    };
  }

  SBL.MODES = [
    { id: "normal", label: "Normal", kind: SBL.KIND.normal },
    { id: "invert", label: "Invertieren", kind: SBL.KIND.invert },
    { id: "contrast", label: "Kontrast", kind: SBL.KIND.contrast },
    duo("white-black", "Weiß auf Schwarz", [1, 1, 1], [0, 0, 0]),
    { id: "white-black-smooth", label: "Weiß auf Schwarz glatt", kind: SBL.KIND.smooth },
    { id: "white-black-smooth-2", label: "2 w auf s glatt", kind: SBL.KIND.smooth2 },
    { id: "white-black-smooth-3", label: "3 w auf s glatt", kind: SBL.KIND.smooth3 },
    { id: "white-black-smooth-4", label: "4 w auf s glatt", kind: SBL.KIND.smooth4 },
    duo("black-white", "Schwarz auf Weiß", [0, 0, 0], [1, 1, 1]),
    { id: "black-white-smooth", label: "Schwarz auf Weiß glatt", kind: SBL.KIND.smoothBw, ink: [0, 0, 0], paper: [1, 1, 1] },
    duo("yellow-black", "Gelb auf Schwarz", [1, 0.9, 0.1], [0, 0, 0]),
    duo("black-yellow", "Schwarz auf Gelb", [0, 0, 0], [1, 0.93, 0.29]),
    duo("white-blue", "Weiß auf Blau", [1, 1, 1], [0, 0.2, 0.6]),
    duo("green-black", "Grün auf Schwarz", [0.72, 1, 0.25], [0, 0, 0]),
    duo("yellow-blue", "Gelb auf Blau", [1, 0.88, 0.08], [0.02, 0.1, 0.36]),
    { id: "yellow-blue-smooth", label: "Gelb auf Blau glatt", kind: SBL.KIND.smoothYb, ink: [1, 0.88, 0.08], paper: [0.02, 0.1, 0.36] },
    { id: "amber", label: "Bernstein", kind: SBL.KIND.amber },
    { id: "amber-smooth", label: "Bernstein glatt", kind: SBL.KIND.smoothAmber },
    { id: "gray", label: "Graustufen", kind: SBL.KIND.gray },
    { id: "gray-smooth", label: "Graustufen glatt", kind: SBL.KIND.smoothGray },
    { id: "red-green", label: "Farbhilfe Rot-Grün", kind: SBL.KIND.dalton },
    duo("black-lightgreen", "Schwarz auf Hellgrün", [0, 0, 0], [0.72, 0.98, 0.62]),
    duo("black-lightblue", "Schwarz auf Hellblau", [0, 0, 0], [0.62, 0.86, 1]),
    { id: "edges", label: "Kanten", kind: SBL.KIND.edges }
  ];

  SBL.modeById = function (id) {
    for (var i = 0; i < SBL.MODES.length; i += 1) {
      if (SBL.MODES[i].id === id) return SBL.MODES[i];
    }
    return SBL.MODES[0];
  };

  SBL.formatZoom = function (value) {
    var rounded = Math.round(value * 10) / 10;
    return rounded.toFixed(1).replace(".", ",") + "×";
  };
})(window.SBL = window.SBL || {});
