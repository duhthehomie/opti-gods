// ═══════════════════════════════════════════════════════════════════════════
//  OptiGodsOverlay.fx  —  Opti Gods Logo Overlay for ReShade + FiveM
//  by leaq  ·  optigods.com
// ───────────────────────────────────────────────────────────────────────────
//  INSTALL
//  ① Copy OptiGodsOverlay.fx  →  reshade-shaders\Shaders\
//  ② Copy both PNGs from Textures → reshade-shaders\Textures\
//  ③ Enable in ReShade (Home key). Adjust Position + Scale as needed.
// ═══════════════════════════════════════════════════════════════════════════

#include "ReShade.fxh"

#ifndef OPTIGODS_TEX_WIDTH
 #define OPTIGODS_TEX_WIDTH  1024
#endif
#ifndef OPTIGODS_TEX_HEIGHT
 #define OPTIGODS_TEX_HEIGHT 256
#endif

texture texOptiGodsLogo < source = "OptiGodsLogoTransparent.png"; >
{
    Width  = OPTIGODS_TEX_WIDTH;
    Height = OPTIGODS_TEX_HEIGHT;
    Format = RGBA8;
};
sampler sOptiGodsLogo
{
    Texture   = texOptiGodsLogo;
    AddressU  = CLAMP;
    AddressV  = CLAMP;
    MinFilter = LINEAR;
    MagFilter = LINEAR;
};

texture texOptiGodsAd < source = "OptiGodsFreeTweaks.png"; >
{
    Width = 1536;
    Height = 256;
    Format = RGBA8;
};
sampler sOptiGodsAd
{
    Texture = texOptiGodsAd;
    AddressU = CLAMP;
    AddressV = CLAMP;
    MinFilter = LINEAR;
    MagFilter = LINEAR;
};

// ── UI ────────────────────────────────────────────────────────────────────
uniform bool bShowLogo <
    ui_label = "Show logo (off = website ad only)";
> = true;

uniform bool bBlackLogo <
    ui_label = "Black logo";
    ui_tooltip = "Solid black letters. Overrides logo color only; glow remains independently adjustable.";
> = false;

uniform bool bOriginalGoldLogo <
    ui_label = "Use original gold texture";
    ui_tooltip = "Turn off to use the Logo color picker. Black logo overrides both.";
> = false;

uniform float3 fLogoInk <
    ui_type = "color";
    ui_label = "Logo color";
    ui_tooltip = "Applies directly unless Black logo or Use original gold texture is enabled.";
> = float3(1.0, 0.0, 0.0);

uniform float3 fGlowColor <
    ui_type = "color";
    ui_label = "Glow color";
> = float3(1.0, 0.12, 0.05);

uniform bool bShowAd <
    ui_label = "Show 15 free tweaks ad";
> = true;

uniform bool bAdAlwaysVisible <
    ui_label = "Keep ad on screen";
    ui_tooltip = "Disable for a repeating fade-and-slide animation.";
> = false;

uniform bool bAdLightSweep <
    ui_label = "Ad red light sweep";
    ui_tooltip = "A subtle red highlight crosses the banner every four seconds. Text stays still.";
> = true;

uniform bool bAdPanelPulse <
    ui_label = "Ad gentle panel pulse";
    ui_tooltip = "Slowly brightens the red Enable Best 15 Tweaks panel without flashing or moving text.";
> = true;

uniform float fAdDuration <
    ui_type = "drag";
    ui_label = "Ad visible time (seconds)";
    ui_min = 3.0; ui_max = 30.0; ui_step = 1.0;
> = 8.0;

uniform float fAdPause <
    ui_type = "drag";
    ui_label = "Pause between ads (seconds)";
    ui_min = 0.0; ui_max = 120.0; ui_step = 1.0;
> = 22.0;

uniform float2 fAdPosition <
    ui_type = "drag";
    ui_label = "Ad position (X, Y)";
    ui_min = 0.0; ui_max = 1.0; ui_step = 0.001;
> = float2(0.5, 0.90);

uniform float fAdWidth <
    ui_type = "drag";
    ui_label = "Ad width (fraction of screen)";
    ui_min = 0.20; ui_max = 0.95; ui_step = 0.01;
> = 0.40;

uniform float fAdOpacity <
    ui_type = "drag";
    ui_label = "Ad opacity";
    ui_min = 0.0; ui_max = 1.0; ui_step = 0.01;
> = 1.0;

uniform float fPosX <
    ui_type    = "drag";
    ui_label   = "Position X  (Left → Right)";
    ui_tooltip = "0.0 = far left   0.5 = center   1.0 = far right";
    ui_min     =  0.0;
    ui_max     =  1.0;
    ui_step    =  0.001;
> = 0.88;

uniform float fPosY <
    ui_type    = "drag";
    ui_label   = "Position Y  (Top → Bottom)";
    ui_tooltip = "0.0 = top   0.5 = center   1.0 = bottom";
    ui_min     =  0.0;
    ui_max     =  1.0;
    ui_step    =  0.001;
> = 0.88;

uniform float fScale <
    ui_type    = "drag";
    ui_label   = "Scale";
    ui_min     =  0.01;
    ui_max     =  1.00;
    ui_step    =  0.001;
> = 0.10;

uniform float fOpacity <
    ui_type    = "drag";
    ui_label   = "Opacity";
    ui_min     =  0.0;
    ui_max     =  1.0;
    ui_step    =  0.001;
> = 1.0;

uniform bool bSpin <
    ui_label   = "Spinning";
> = false;

uniform float fSpinSpeed <
    ui_type    = "drag";
    ui_label   = "Spin Speed";
    ui_min     =  0.05;
    ui_max     =  5.0;
    ui_step    =  0.01;
> = 0.35;

uniform float fGlowStrength <
    ui_type    = "drag";
    ui_label   = "Glow Strength";
    ui_tooltip = "Glow around the actual letters, independent of logo color. Set to 0 to disable.";
    ui_min     =  0.0;
    ui_max     =  3.0;
    ui_step    =  0.01;
> = 1.4;

uniform float fGlowRadius <
    ui_type    = "drag";
    ui_label   = "Glow Radius";
    ui_min     =  0.5;
    ui_max     =  24.0;
    ui_step    =  0.05;
> = 2.8;

uniform float fTimer < source = "timer"; >;

// ── Shader ────────────────────────────────────────────────────────────────
float4 SampleOptiGodsLogo(float2 uv)
{
    if (any(uv < 0.0) || any(uv > 1.0)) return float4(0.0, 0.0, 0.0, 0.0);
    return tex2D(sOptiGodsLogo, uv);
}

float4 CompositeOptiGodsLogo(float2 uv)
{
    float4 back = tex2D(ReShade::BackBuffer, uv);
    if (!bShowLogo || fOpacity <= 0.0) return back;

    float texAspect    = float(OPTIGODS_TEX_WIDTH) / float(OPTIGODS_TEX_HEIGHT);
    float logoHeight = max(fScale, 0.01) * float(BUFFER_HEIGHT);
    float2 logoSize = float2(logoHeight * texAspect, logoHeight);
    // Rotate in screen PIXELS, before normalizing into the wide texture.
    // Rotating normalized texture UVs stretches a non-square logo.
    float2 offset = (uv - float2(fPosX, fPosY)) * float2(BUFFER_WIDTH, BUFFER_HEIGHT);

    if (bSpin)
    {
        float angle = fTimer * 0.001 * fSpinSpeed * 6.2831853;
        float s = sin(angle), c = cos(angle);
        offset = float2(c * offset.x - s * offset.y,
                        s * offset.x + c * offset.y);
    }
    float2 logoUV = offset / logoSize + 0.5;
    float2 radius = max(fGlowRadius, 0.5) / logoSize;
    // Skip distant pixels, while leaving room for the alpha-based halo.
    if (any(logoUV < -radius) || any(logoUV > 1.0 + radius)) return back;
    float4 logo = SampleOptiGodsLogo(logoUV);

    // Sample actual letter edges, including the holes in the letters.
    // No rectangular-texture glow and no colored rim over the selected ink.
    float glowAlpha = 0.0;
    if (fGlowStrength > 0.0)
    {
        glowAlpha += SampleOptiGodsLogo(logoUV + float2(radius.x, 0.0)).a;
        glowAlpha += SampleOptiGodsLogo(logoUV - float2(radius.x, 0.0)).a;
        glowAlpha += SampleOptiGodsLogo(logoUV + float2(0.0, radius.y)).a;
        glowAlpha += SampleOptiGodsLogo(logoUV - float2(0.0, radius.y)).a;
        float2 diagonal = radius * 0.70710678;
        glowAlpha += SampleOptiGodsLogo(logoUV + diagonal).a;
        glowAlpha += SampleOptiGodsLogo(logoUV - diagonal).a;
        glowAlpha += SampleOptiGodsLogo(logoUV + float2(diagonal.x, -diagonal.y)).a;
        glowAlpha += SampleOptiGodsLogo(logoUV + float2(-diagonal.x, diagonal.y)).a;
        glowAlpha = saturate(glowAlpha * 0.125 * fGlowStrength) * fOpacity;
    }

    float3 logoColor = bBlackLogo ? float3(0.0, 0.0, 0.0) : (bOriginalGoldLogo ? logo.rgb : fLogoInk);
    float3 composited = lerp(back.rgb, fGlowColor, glowAlpha);
    composited = lerp(composited, logoColor, saturate(logo.a * fOpacity));
    return float4(composited, back.a);
}

float4 PS_OptiGodsOverlay(float4 vpos : SV_Position, float2 uv : TEXCOORD) : SV_Target
{
    float4 back = CompositeOptiGodsLogo(uv);
    if (!bShowAd) return back;

    // ReShade's timer is milliseconds. No video player, browser, or network is used.
    float duration = max(fAdDuration, 3.0);
    // ReShade FX does not expose HLSL's fmod intrinsic on all versions.
    float cycle = duration + max(fAdPause, 0.0);
    float elapsed = fTimer * 0.001;
    float phase = elapsed - floor(elapsed / cycle) * cycle;
    float visibility = bAdAlwaysVisible ? 1.0 :
        smoothstep(0.0, 0.6, phase) * (1.0 - smoothstep(duration - 0.6, duration, phase));
    if (visibility <= 0.0) return back;

    float width = clamp(fAdWidth, 0.20, 0.95);
    float height = width * ReShade::AspectRatio / 6.0;
    float2 size = float2(width, height);
    // Keep the whole banner on screen when a position slider reaches an edge.
    float2 center = clamp(fAdPosition, size * 0.5, 1.0 - size * 0.5);
    center.y += (1.0 - visibility) * 0.015;
    float2 adUV = (uv - center) / size + 0.5;
    if (any(adUV < 0.0) || any(adUV > 1.0)) return back;
    float4 ad = tex2D(sOptiGodsAd, adUV);
    // Animate light only: never shift the lettering or change the texture alpha.
    // Restart with each timed appearance; continuous mode runs uninterrupted.
    float animationTime = bAdAlwaysVisible ? elapsed : phase;
    float whiteText = smoothstep(0.65, 0.95, min(ad.r, min(ad.g, ad.b)));
    if (bAdPanelPulse)
    {
        float pulse = 0.5 - 0.5 * cos(animationTime * 1.9634954); // 3.2 seconds
        float panel = smoothstep(0.65, 0.67, adUV.x) *
            (1.0 - smoothstep(0.97, 0.98, adUV.x)) *
            smoothstep(0.13, 0.16, adUV.y) *
            (1.0 - smoothstep(0.82, 0.86, adUV.y));
        float redInk = smoothstep(0.15, 0.45, ad.r - max(ad.g, ad.b));
        ad.rgb += float3(0.10, 0.015, 0.01) * pulse * panel * redInk * (1.0 - whiteText);
    }
    if (bAdLightSweep)
    {
        // One short pass, then a pause. Avoid fmod for ReShade FX compatibility.
        float sweepTime = max(animationTime - 0.7, 0.0) * 0.25;
        float sweepPhase = sweepTime - floor(sweepTime);
        float sweepCenter = -0.18 + sweepPhase * 3.4;
        float distance = abs(adUV.x + (adUV.y - 0.5) * 0.12 - sweepCenter);
        float sweep = 1.0 - smoothstep(0.0, 0.055, distance);
        ad.rgb += float3(0.22, 0.045, 0.035) * sweep * (1.0 - whiteText);
    }
    ad.rgb = saturate(ad.rgb);
    return float4(lerp(back.rgb, ad.rgb, saturate(ad.a * visibility * fAdOpacity)), back.a);
}

technique OptiGodsOverlay < ui_label = "Opti Gods Logo Overlay"; >
{
    pass
    {
        VertexShader = PostProcessVS;
        PixelShader  = PS_OptiGodsOverlay;
    }
}
