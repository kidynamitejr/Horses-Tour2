# Turns the player headshots (already shot on plain white) into transparent
# PNG cut-outs for the player profile header.
#
# The white background is flood-filled inward from the image edges, so white
# shirts/hats inside the player's outline are kept. Edge pixels get partial
# transparency so the outline blends smoothly onto any background.
#
# Usage (from the project folder):
#   powershell -ExecutionPolicy Bypass -File scripts\make-player-cutouts.ps1
#
# Re-run it whenever you add or replace a photo in public\images\players.

param(
  [int]$MaxHeight = 720,
  [int]$WhiteThreshold = 232
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class Cutout
{
    public static void Make(string src, string dest, int maxHeight, int threshold)
    {
        using (var original = Image.FromFile(src))
        {
            int h = Math.Min(maxHeight, original.Height);
            int w = (int)Math.Round(original.Width * (double)h / original.Height);

            using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb))
            {
                using (var g = Graphics.FromImage(bmp))
                {
                    g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                    g.DrawImage(original, 0, 0, w, h);
                }

                var rect = new Rectangle(0, 0, w, h);
                var data = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
                int stride = data.Stride;
                var px = new byte[stride * h];
                Marshal.Copy(data.Scan0, px, 0, px.Length);

                Func<int, int, bool> isWhite = (x, y) =>
                {
                    int i = y * stride + x * 4;
                    byte b = px[i], gg = px[i + 1], r = px[i + 2];
                    int mn = Math.Min(r, Math.Min(gg, b));
                    int mx = Math.Max(r, Math.Max(gg, b));
                    return mn >= threshold && (mx - mn) <= 24;
                };

                // Flood fill the background from every edge pixel.
                var bg = new bool[w * h];
                var queue = new Queue<int>();

                for (int x = 0; x < w; x++) { queue.Enqueue(x); queue.Enqueue((h - 1) * w + x); }
                for (int y = 0; y < h; y++) { queue.Enqueue(y * w); queue.Enqueue(y * w + w - 1); }

                while (queue.Count > 0)
                {
                    int p = queue.Dequeue();
                    if (bg[p]) continue;
                    int x = p % w, y = p / w;
                    if (!isWhite(x, y)) continue;
                    bg[p] = true;
                    if (x > 0) queue.Enqueue(p - 1);
                    if (x < w - 1) queue.Enqueue(p + 1);
                    if (y > 0) queue.Enqueue(p - w);
                    if (y < h - 1) queue.Enqueue(p + w);
                }

                for (int y = 0; y < h; y++)
                {
                    for (int x = 0; x < w; x++)
                    {
                        int p = y * w + x;
                        int i = y * stride + x * 4;

                        if (bg[p]) { px[i + 3] = 0; continue; }

                        // Feather pixels touching the background: the whiter
                        // they are, the more transparent.
                        bool edge =
                            (x > 0 && bg[p - 1]) || (x < w - 1 && bg[p + 1]) ||
                            (y > 0 && bg[p - w]) || (y < h - 1 && bg[p + w]);

                        if (edge)
                        {
                            int mn = Math.Min(px[i + 2], Math.Min(px[i + 1], px[i]));
                            double whiteness = Math.Max(0, (mn - 170) / 85.0);
                            px[i + 3] = (byte)Math.Round(255 * (1 - 0.85 * whiteness));
                        }
                    }
                }

                Marshal.Copy(px, 0, data.Scan0, px.Length);
                bmp.UnlockBits(data);
                bmp.Save(dest, ImageFormat.Png);
            }
        }
    }
}
"@

$root = Split-Path -Parent $PSScriptRoot
$photos = Join-Path $root "public\images\players"
$out = Join-Path $photos "cutouts"

New-Item -ItemType Directory -Force $out | Out-Null

Get-ChildItem (Join-Path $photos "*") -File -Include *.jpg, *.jpeg, *.png |
  ForEach-Object {
    $dest = Join-Path $out ($_.BaseName + ".png")
    [Cutout]::Make($_.FullName, $dest, $MaxHeight, $WhiteThreshold)
    "{0,-14} -> cutouts\{1}  ({2} KB)" -f $_.Name, ($_.BaseName + ".png"), [int]((Get-Item $dest).Length / 1KB)
  }
