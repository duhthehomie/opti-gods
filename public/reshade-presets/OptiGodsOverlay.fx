// ═══════════════════════════════════════════════════════════════════════════
//  OptiGodsOverlay.fx  —  Opti Gods Logo Overlay for ReShade + FiveM
//  by leaq  ·  optigods.com
// ───────────────────────────────────────────────────────────────────────────
//  INSTALL
//  ① Copy this file to:
//     C:\Users\<you>\AppData\Local\FiveM\FiveM.app\plugins\reshade-shaders\Shaders\
//
//  ② Copy OptiGodsLogo.png to:
//     C:\Users\<you>\AppData\Local\FiveM\FiveM.app\plugins\reshade-shaders\Textures\
//     (Download both from optigods.com or your Opti Gods release folder)
//
//  ③ Open ReShade in FiveM (Home key), find "OptiGodsOverlay" and enable it.
//     Adjust "Position", "Scale", and "Opacity" sliders to place the logo
//     exactly where you want it on screen.
//
//  TIP: Set OPTIGODS_TEX_WIDTH / OPTIGODS_TEX_HEIGHT preprocessor defines
//       to match the actual pixel dimensions of your OptiGodsLogo.png.
// ═══════════════════════════════════════════════════════════════════════════

#include "ReShade.fxh"

// ── Preprocessor defines (match your texture dimensions) ─────────────────
#ifndef OPTIGODS_TEX_WIDTH
 #define OPTIGODS_TEX_WIDTH  512
#endif
#ifndef OPTIGODS_TEX_HEIGHT
 #define OPTIGODS_TEX_HEIGHT 512
#endif

// ── Texture + sampler ─────────────────────────────────────────────────────
texture  texOptiGodsLogo < source = "OptiGodsLogo.png"; >
{
    Width  = OPTIGODS_TEX_WIDTH;
    Height = OPTIGODS_TEX_HEIGHT;
    Format = RGBA8;
};
sampler  sOptiGodsLogo
{
    Texture   = texOptiGodsLogo;
    AddressU  = CLAMP;
    AddressV  = CLAMP;
    MinFilter = LINEAR;
    MagFilter = LINEAR;
};

// ── UI parameters ─────────────────────────────────────────────────────────
uniform float2 fPosition <
    ui_type    = "drag";
    ui_label   = "Position";
    ui_tooltip = "Drag to reposition the logo. (0.5, 0.5) = center of screen.";
    ui_min     = -0.5;
    ui_max     =  1.5;
    ui_step    =  0.001;
> = float2(0.85, 0.90);

uniform float fScale <
    ui_type    = "drag";
    ui_label   = "Scale";
    ui_tooltip = "Logo size. 0.10 = 10% of screen height.";
    ui_min     =  0.01;
    ui_max     =  1.00;
    ui_step    =  0.001;
> = 0.12;

uniform float fOpacity <
    ui_type    = "drag";
    ui_label   = "Opacity";
    ui_min     =  0.0;
    ui_max     =  1.0;
    ui_step    =  0.001;
> = 0.85;

uniform bool bSpin <
    ui_label   = "Spinning Animation";
    ui_tooltip = "Slowly rotates the logo in-game.";
> = false;

uniform float fSpinSpeed <
    ui_type    = "drag";
    ui_label   = "Spin Speed";
    ui_tooltip = "Rotations per second when Spinning is enabled.";
    ui_min     =  0.05;
    ui_max     =  5.0;
    ui_step    =  0.01;
> = 0.4;

uniform bool bGlow <
    ui_label   = "Red Glow Halo";
    ui_tooltip = "Adds a red glowing aura around the logo.";
> = true;

uniform float fGlowRadius <
    ui_type    = "drag";
    ui_label   = "Glow Radius";
    ui_min     =  0.5;
    ui_max     =  4.0;
    ui_step    =  0.01;
> = 1.8;

uniform bool bRemoveBg <
    ui_label   = "Remove White/Black Background";
    ui_tooltip = "Keys out near-white or near-black pixels if your PNG lacks an alpha channel.";
> = false;

uniform float fBgThreshold <
    ui_type    = "drag";
    ui_label   = "BG Key Threshold";
    ui_min     =  0.0;
    ui_max     =  1.0;
    ui_step    =  0.001;
> = 0.92;

uniform float fTimer < source = "timer"; >;

// ── Pixel shader ──────────────────────────────────────────────────────────
float4 PS_OptiGodsOverlay(float4 vpos : SV_Position, float2 uv : TEXCOORD) : SV_Target
{
    float4 back = tex2D(ReShade::BackBuffer, uv);

    // Normalised texture size relative to screen (keeping aspect ratio)
    float texAspect  = float(OPTIGODS_TEX_WIDTH) / float(OPTIGODS_TEX_HEIGHT);
    float screenAspect = ReShade::AspectRatio; // BUFFER_WIDTH / BUFFER_HEIGHT

    float scaleY = fScale;
    float scaleX = fScale * texAspect / screenAspect;

    // UV relative to logo centre
    float2 logoUV = (uv - fPosition) / float2(scaleX, scaleY) + 0.5;

    // Optional spin
    if (bSpin)
    {
        float angle = fTimer * 0.001 * fSpinSpeed * 6.2831853;
        float s = sin(angle), c = cos(angle);
        float2 centered = logoUV - 0.5;
        logoUV = float2(c * centered.x - s * centered.y,
                        s * centered.x + c * centered.y) + 0.5;
    }

    // Clip outside logo bounds
    if (any(saturate(logoUV) != logoUV))
    {
        // Optional glow bleed beyond logo edge
        if (bGlow)
        {
            float2 clamped = clamp(logoUV, 0.0, 1.0);
            float dist = length((logoUV - clamped) * float2(scaleX, scaleY) * float(BUFFER_HEIGHT));
            float glow  = exp(-dist * fGlowRadius) * fOpacity * 0.35;
            float4 edge = tex2D(sOptiGodsLogo, clamped);
            float  edgeA = edge.a;
            if (bRemoveBg)
            {
                float lum = dot(edge.rgb, float3(0.299, 0.587, 0.114));
                edgeA = (lum < fBgThreshold) ? 1.0 : 0.0;
            }
            back.rgb = lerp(back.rgb, float3(1.0, 0.15, 0.08), glow * saturate(edgeA));
        }
        return back;
    }

    float4 logo = tex2D(sOptiGodsLogo, logoUV);

    // Background removal (for PNGs without alpha)
    float alpha = logo.a;
    if (bRemoveBg)
    {
        float lum = dot(logo.rgb, float3(0.299, 0.587, 0.114));
        alpha = (lum < fBgThreshold) ? 1.0 : 0.0;
    }

    alpha *= fOpacity;

    // Composite: logo over background
    float3 composite = lerp(back.rgb, logo.rgb, alpha);

    // Glow halo overlay on top of logo pixels
    if (bGlow && alpha > 0.05)
    {
        float rimDist = length(logoUV - 0.5);
        float rim = smoothstep(0.5, 0.3, rimDist) * 0.12 * fOpacity;
        composite = lerp(composite, float3(1.0, 0.2, 0.06), rim * alpha);
    }

    return float4(composite, back.a);
}

// ── Technique ─────────────────────────────────────────────────────────────
technique OptiGodsOverlay < ui_label = "Opti Gods Logo Overlay"; >
{
    pass
    {
        VertexShader = PostProcessVS;
        PixelShader  = PS_OptiGodsOverlay;
    }
}
