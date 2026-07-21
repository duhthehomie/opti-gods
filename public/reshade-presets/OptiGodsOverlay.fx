// ═══════════════════════════════════════════════════════════════════════════
//  OptiGodsOverlay.fx  —  Opti Gods Logo Overlay for ReShade + FiveM
//  by leaq  ·  optigods.com
// ───────────────────────────────────────────────────────────────────────────
//  INSTALL
//  ① Copy OptiGodsOverlay.fx  →  reshade-shaders\Shaders\
//  ② Copy OptiGodsLogo.png    →  reshade-shaders\Textures\
//  ③ Enable in ReShade (Home key). Adjust Position + Scale as needed.
// ═══════════════════════════════════════════════════════════════════════════

#include "ReShade.fxh"

#ifndef OPTIGODS_TEX_WIDTH
 #define OPTIGODS_TEX_WIDTH  512
#endif
#ifndef OPTIGODS_TEX_HEIGHT
 #define OPTIGODS_TEX_HEIGHT 512
#endif

texture texOptiGodsLogo < source = "OptiGodsLogo.png"; >
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

// ── UI ────────────────────────────────────────────────────────────────────
uniform float2 fPosition <
    ui_type    = "drag";
    ui_label   = "Position";
    ui_tooltip = "Move the logo anywhere on screen. (0.5, 0.5) = center.";
    ui_min     = -0.5;
    ui_max     =  1.5;
    ui_step    =  0.001;
> = float2(0.88, 0.88);

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
> = true;

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
    ui_tooltip = "Intensity of the red glow around the logo.";
    ui_min     =  0.0;
    ui_max     =  3.0;
    ui_step    =  0.01;
> = 1.4;

uniform float fGlowRadius <
    ui_type    = "drag";
    ui_label   = "Glow Radius";
    ui_min     =  0.5;
    ui_max     =  8.0;
    ui_step    =  0.05;
> = 2.8;

uniform float fTimer < source = "timer"; >;

// ── Shader ────────────────────────────────────────────────────────────────
float4 PS_OptiGodsOverlay(float4 vpos : SV_Position, float2 uv : TEXCOORD) : SV_Target
{
    float4 back = tex2D(ReShade::BackBuffer, uv);

    float texAspect    = float(OPTIGODS_TEX_WIDTH) / float(OPTIGODS_TEX_HEIGHT);
    float screenAspect = ReShade::AspectRatio;

    float scaleY = fScale;
    float scaleX = fScale * texAspect / screenAspect;

    float2 logoUV = (uv - fPosition) / float2(scaleX, scaleY) + 0.5;

    // Spin
    if (bSpin)
    {
        float angle = fTimer * 0.001 * fSpinSpeed * 6.2831853;
        float s = sin(angle), c = cos(angle);
        float2 centered = logoUV - 0.5;
        logoUV = float2(c * centered.x - s * centered.y,
                        s * centered.x + c * centered.y) + 0.5;
    }

    bool inBounds = all(saturate(logoUV) == logoUV);

    // ── Glow bleed outside logo bounds ───────────────────────────────────
    float glowAlpha = 0.0;
    if (!inBounds && fGlowStrength > 0.0)
    {
        float2 clamped  = clamp(logoUV, 0.0, 1.0);
        float2 uvDiff   = (logoUV - clamped) * float2(scaleX, scaleY) * float(BUFFER_HEIGHT);
        float  dist     = length(uvDiff);
        float  falloff  = exp(-dist * fGlowRadius);
        float4 edgeTex  = tex2D(sOptiGodsLogo, clamped);
        glowAlpha = falloff * edgeTex.a * fGlowStrength * fOpacity;
    }

    if (!inBounds)
    {
        // Animated pulse on the glow
        float pulse = 0.85 + 0.15 * sin(fTimer * 0.002);
        float3 glowColor = float3(1.0, 0.12, 0.05) * pulse;
        return float4(lerp(back.rgb, glowColor, saturate(glowAlpha)), back.a);
    }

    // ── Logo composite ───────────────────────────────────────────────────
    float4 logo  = tex2D(sOptiGodsLogo, logoUV);
    float  alpha = logo.a * fOpacity;

    // Inner glow rim on the logo itself
    float rimDist = length(logoUV - 0.5) * 2.0;
    float rim = smoothstep(1.0, 0.5, rimDist) * 0.18 * fGlowStrength * alpha;
    float pulse2 = 0.8 + 0.2 * sin(fTimer * 0.002 + 1.0);
    float3 rimColor = float3(1.0, 0.1, 0.04) * pulse2;

    float3 composited = lerp(back.rgb, logo.rgb, alpha);
    composited = lerp(composited, rimColor, rim);

    return float4(composited, back.a);
}

technique OptiGodsOverlay < ui_label = "Opti Gods Logo Overlay"; >
{
    pass
    {
        VertexShader = PostProcessVS;
        PixelShader  = PS_OptiGodsOverlay;
    }
}
