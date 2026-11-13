/* Standbild einer Packungsbeilage, falls keine Kamera da ist.
   So lassen sich Zoom und Farbmodi auch am Schreibtisch prüfen. */
(function (SBL) {
  "use strict";

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    var words = text.split(" ");
    var line = "";
    var cursor = y;
    for (var i = 0; i < words.length; i += 1) {
      var attempt = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(attempt).width > maxWidth && line) {
        ctx.fillText(line, x, cursor);
        line = words[i];
        cursor += lineHeight;
      } else {
        line = attempt;
      }
    }
    if (line) ctx.fillText(line, x, cursor);
    return cursor + lineHeight;
  }

  SBL.createDemoSource = function () {
    var canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1440;
    var ctx = canvas.getContext("2d");
    var font = "Arial, 'DejaVu Sans', 'Liberation Sans', sans-serif";

    ctx.fillStyle = "#f4f0e6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#102a56";
    ctx.fillRect(0, 0, canvas.width, 168);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 78px " + font;
    ctx.fillText("Beipackzettel", 64, 108);

    ctx.fillStyle = "#1a1a1a";
    ctx.font = "700 52px " + font;
    ctx.fillText("Kleingedrucktes lesen", 64, 250);

    ctx.font = "400 36px " + font;
    var body = "Halten Sie das Telefon über den Text. Mit dem Regler oder mit zwei Fingern stellen Sie die Vergrößerung ein. Die Darstellungstaste ändert nur die Farben, nicht das Blatt.";
    var y = wrapText(ctx, body, 64, 330, 950, 52);

    ctx.font = "700 34px " + font;
    ctx.fillText("Dosierung", 64, y + 20);
    y += 70;
    ctx.font = "400 32px " + font;
    var rows = [
      "Morgens    1 Tablette    mit Wasser",
      "Mittags    1 Tablette    nach dem Essen",
      "Abends     1 Tablette    vor dem Schlafen"
    ];
    for (var r = 0; r < rows.length; r += 1) {
      ctx.fillText(rows[r], 64, y);
      y += 48;
    }

    y += 24;
    ctx.font = "400 26px " + font;
    ctx.fillStyle = "#222";
    var small = "Sehr kleine Zeile: Nebenwirkungen können Schwindel, trockene Augen und Lichtempfindlichkeit sein. Bei Unsicherheit die Packung in die Apotheke mitnehmen. Charge AB-2048, haltbar bis 08/2028.";
    y = wrapText(ctx, small, 64, y, 950, 38);

    ctx.fillStyle = "#111";
    var barcodeX = 64;
    var barcodeY = canvas.height - 220;
    var widths = [4, 2, 6, 2, 3, 8, 2, 5, 2, 4, 10, 3, 2, 6, 2, 4, 8, 2, 3, 5, 2, 7, 3, 2, 4];
    for (var b = 0; b < widths.length; b += 1) {
      var w = widths[b] * 4;
      if (b % 2 === 0) ctx.fillRect(barcodeX, barcodeY, w, 130);
      barcodeX += w;
    }

    ctx.font = "700 28px " + font;
    ctx.fillText("PZN 12345678", 64, canvas.height - 48);

    return canvas;
  };
})(window.SBL = window.SBL || {});
