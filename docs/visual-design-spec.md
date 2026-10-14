# Technical Documentation — Visual Design Prompt Engineering for the original board game

**Engineering for the original board game Digital Platform**
Comprehensive AI Art Direction and Interactive 3D Design Specification

Version 1.0 | August 25, 2026
Creative Technology Division
Classification: Internal — Confidential

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Introduction and Purpose](#2-introduction-and-purpose)
3. [Art Direction Framework](#3-art-direction-framework)
4. [Victorian Industrial Realism: Asset Prompt Specifications](#4-victorian-industrial-realism-asset-prompt-specifications)
5. [Abstract Kinetic Art: Visual Concept and Code Prompts](#5-abstract-kinetic-art-visual-concept-and-code-prompts)
6. [Prompt Engineering Best Practices](#6-prompt-engineering-best-practices)
7. [Pro-Tips for Elevating Results](#7-pro-tips-for-elevating-results)
8. [Consistency and Quality Assurance](#8-consistency-and-quality-assurance)
9. [Legal and Ethical Considerations](#9-legal-and-ethical-considerations)
10. [References](#10-references)

---

## 1. Executive Summary

This document provides a comprehensive, production-ready prompt engineering specification for generating the complete visual asset pack of a premium digital version of the original board game. the original board game, designed by Martin Wallace, Gavan Brown, and Matt Tolman and published by Roxley Games, is the third highest-rated board game of all time on BoardGameGeek, set against the backdrop of the Industrial Revolution in Birmingham, England. The visual identity defined herein combines Victorian-era industrial architecture, brass and copper mechanical detailing, atmospheric coal-smoke lighting, and a premium AAA board-game presentation aesthetic into a cohesive visual system that makes the digital platform feel like a physical Victorian industrial strategy board game brought to life as a cinematic digital experience.

The document is structured around two complementary creative approaches. The first approach, detailed in Section 4, defines a rigorous Victorian Industrial Realism art direction for generating ten categories of production-ready visual assets, from website hero imagery to individual industry tiles and resource icons. The second approach, detailed in Section 5, defines an Abstract Kinetic Art Installation vision that reimagines the board as a non-Euclidean topographic landscape of frosted glass and iridescent metallic alloys, suitable for generating avant-garde visual concepts via AI image generators or building interactive 3D web experiences via Three.js and WebGL. Both approaches are supported by prompt engineering best practices, platform-specific parameter references, and a consistency assurance framework designed to ensure that every generated asset belongs to the same professionally designed game.

Each asset category includes a complete, copy-paste-ready prompt optimized for Midjourney v6.1, with extension notes for DALL-E 3, Stable Diffusion, and video AI platforms such as Sora and Runway. The document also provides a complete Three.js code generation prompt for building the interactive 3D web experience, including custom GLSL shader specifications, GSAP animation requirements, spatial audio integration guidance, and raycasting-based interaction logic. All prompts have been refined through research into contemporary prompt engineering methodologies, Midjourney v6 language sensitivity, and the specific challenges of generating cohesive board-game art systems through AI image generation tools.

## 2. Introduction and Purpose

### 2.1 Document Purpose

This technical documentation serves as the definitive prompt engineering reference for the visual production pipeline of the the original board game digital platform. It addresses a fundamental challenge in AI-assisted game art production: achieving visual consistency across a large set of diverse assets when each asset is generated independently through text-to-image models. The document solves this problem by establishing a Universal Art Direction Control Prompt that anchors every generation to the same visual language, material palette, and atmospheric quality, then providing asset-specific prompts that layer unique compositional and subject-matter requirements on top of that shared foundation.

The dual-approach structure reflects the reality that modern digital board game development often requires both static visual assets for marketing, menus, and tutorials, and interactive 3D environments for gameplay. The Victorian Industrial Realism approach generates production-ready 2D assets suitable for website backgrounds, card art, and UI overlays. The Abstract Kinetic Art approach generates striking 3D concepts and playable WebGL experiences that push the boundaries of what a browser-based board game can look like. Both approaches can coexist within the same product: the realistic assets serve the thematic and narrative layer, while the abstract 3D environment provides the interactive gameplay canvas.

### 2.2 Target Audience

This document is intended for creative directors, art producers, prompt engineers, and front-end developers working on the the original board game digital adaptation. It assumes familiarity with AI image generation tools such as Midjourney, DALL-E 3, and Stable Diffusion, as well as basic knowledge of web development technologies including Three.js, WebGL, and GLSL shaders. Each prompt is self-contained and can be used independently by copying it directly into the relevant AI tool. The document provides sufficient context for each prompt that even practitioners unfamiliar with the original board game can execute the generations correctly and achieve visually consistent results.

## 3. Art Direction Framework

The visual identity of the the original board game digital platform is built on two complementary aesthetic pillars that serve different functional roles within the product. Understanding how these pillars interact is essential for anyone executing the prompt specifications in this document. The Victorian Industrial Realism pillar provides the thematic, narrative, and historical foundation. It grounds the experience in the actual setting of the game: Birmingham, England, during the late eighteenth and early nineteenth centuries, when the city was the workshop of the world. The Abstract Kinetic Art pillar provides the experiential, interactive, and emotional layer. It transforms the gameplay from a mechanical exercise in resource management into a visceral, museum-quality encounter with light, material, and motion.

### 3.1 Pillar 1: Victorian Industrial Realism

This pillar defines the visual language for all narrative, thematic, and informational assets. The aesthetic draws on the actual architecture, industry, and material culture of Georgian and Victorian Birmingham. Brick factories with tall smoking chimneys dominate the skyline. Canal boats navigate waterways lined with iron warehouses. Early railway infrastructure cuts through the landscape on embankments and bridges. Brass and copper mechanical details, visible in the gearing of industrial machinery, the fittings of canal locks, and the ornamentation of Victorian public buildings, provide a warm metallic accent that gives the palette its distinctive character. Weathered wood, aged paper, and printed parchment surfaces provide a tactile, handmade quality that evokes the physical components of a premium tabletop game.

The lighting language is moody and atmospheric. Scenes are lit by a combination of amber industrial glow, the warm light of coal fires through factory windows, and the cool blue-grey of the English sky seen through coal smoke and steam. This creates a chiaroscuro effect where the warm brass and copper elements emerge from deep charcoal shadows, producing the sense of depth and drama appropriate for a premium strategy game. The color palette is deliberately muted and desaturated: think aged oils rather than fresh acrylics. The overall effect should feel cinematic, as though each asset is a still frame from a high-budget historical drama rather than a bright, flat illustration.

### 3.2 Pillar 2: Abstract Kinetic Art Installation

This pillar defines the visual language for the interactive 3D gameplay environment and the avant-garde visual concepts that differentiate the digital platform from a simple translation of the physical board game. The aesthetic draws on the work of contemporary artists who explore light, perception, space, and material transformation. Olafur Eliasson's immersive light installations, which create vivid atmospheric phenomena from simple materials like fog, mirrors, and colored light, inform the approach to volumetric lighting and caustic reflections. Zaha Hadid's parametric architecture, characterized by flowing, organic forms that seem to dissolve the boundaries between interior and exterior space, informs the approach to board topology and piece morphology. Anish Kapoor's sculptural work with reflective surfaces and impossible-seeming geometries informs the approach to material quality and visual ambiguity. Refik Anadol's data-driven AI art, which transforms vast datasets into flowing, organic visualizations, informs the approach to particle effects and procedural animation.

The board is not a flat surface but a sprawling, non-Euclidean topographic landscape made of frosted glass, polished obsidian, and iridescent metallic alloys. Game pieces are abstract, floating geometric sculptures that levitate using visible magnetic field lines. The board's surface ripples like a liquid mirror when interacted with, and pieces leave trails of bioluminescent particles as they move. Volumetric lighting, caustic reflections, and deep cinematic shadows create a sense of depth and atmosphere that transcends the boundaries of traditional game interfaces. The aesthetic should feel like a modern art museum installation: contemplative, immersive, and viscerally beautiful.

### 3.3 Shared Design Principles

Despite their different visual vocabularies, both aesthetic pillars share fundamental design principles that ensure cohesion when the approaches are combined within the same product. First, both prioritize atmosphere over decoration: every visual element serves a functional or narrative purpose, and neither approach tolerates gratuitous ornamentation. Second, both employ a restricted, warm metallic color palette: brass, copper, amber, and gold tones provide the primary accent colors, set against dark, muted backgrounds. Third, both emphasize materiality and tactility: surfaces should feel physical and substantial, whether they are rendered as weathered Victorian brickwork or as iridescent frosted glass. Fourth, both use lighting as a primary compositional tool, with strong directional light creating depth, drama, and visual hierarchy. These shared principles ensure that, when a player transitions from a Victorian loading screen into an abstract 3D gameplay board, the experience feels intentional and unified rather than jarring or inconsistent.

## 4. Victorian Industrial Realism: Asset Prompt Specifications

This section provides complete, production-ready prompts for generating each visual asset in the Victorian Industrial Realism style. Every prompt begins with a Universal Art Direction Anchor that ensures cross-asset consistency, followed by asset-specific subject matter and composition instructions. The prompts are optimized for Midjourney v6.1, which requires significantly different prompting techniques than v5: v6.1 is much more sensitive to natural language, handles longer descriptive prompts more accurately, and responds poorly to the keyword-stacking approach that was effective in earlier versions.

### 4.1 Universal Art Direction Control Prompt

The following control prompt must be prepended or conceptually applied to every asset generation to maintain visual consistency. It defines the material palette, lighting language, and stylistic boundaries that all assets share. When using Midjourney, this control prompt can be applied through a style reference image generated from it, or by including its key phrases at the start of every asset-specific prompt.

```text
UNIVERSAL ART DIRECTION ANCHOR:

Cinematic, atmospheric, highly detailed, premium strategy board game art.
Victorian-era Birmingham industrial architecture, brick factories and mills,
coal smoke and steam, iron bridges, canal boats, early railway infrastructure,
brass and copper mechanical details, weathered wood and aged paper, industrial
machinery, Victorian typography-inspired decorative elements. Moody atmospheric
lighting, subtle amber and brass illumination, dark charcoal backgrounds, muted
cream and parchment surfaces. Realistic concept art, tactile materials,
sophisticated composition, historical industrial setting.
Avoid: cartoon aesthetics, futuristic technology, neon cyberpunk, oversaturated
colors, modern UI elements, random text.
```

### 4.2 Asset 1: Website Hero Image

The website hero is the first visual impression of the digital platform. It must establish the thematic setting, the production quality, and the emotional tone in a single, wide-format composition. The image serves as the background for the website's title and primary navigation, so the composition must include deliberate negative space in the center and upper-left area where UI elements will be overlaid.

```text
PROMPT (Asset 1 -- Website Hero):

A cinematic wide establishing shot of industrial Birmingham during the
Industrial Revolution at dusk. Dense brick factories with tall smoking chimneys
line a canal, coal-fired industry glows with amber light through factory
windows, canal boats loaded with goods navigate the waterway, workers in
Victorian attire move between warehouses, early railway tracks cut across the
foreground, an iron bridge spans the canal in the middle distance, steam drifts
through narrow streets lined with dense urban architecture. The sky is a moody
gradient of deep charcoal blue fading to warm amber near the horizon, with coal
smoke catching the last light. Clean negative space in the center and upper-left
area. Cinematic, atmospheric, highly detailed, premium strategy board game,
realistic concept art, tactile materials, sophisticated composition, historical
industrial setting, moody atmospheric lighting, subtle amber brass illumination,
dark charcoal background, muted cream parchment surfaces
--ar 16:9 --style raw --v 6.1 --s 750
```

### 4.3 Asset 2: Interactive Game Board Background

The game board is the central visual element of the gameplay experience. It must function as both a beautiful illustration and a functional map with clearly separated regions where interactive HTML/SVG elements can be placed. The bird's-eye perspective ensures that all game locations are visible simultaneously while maintaining the atmospheric quality of the art direction. The aged parchment and industrial cartography aesthetic ensures the board feels like a historical artifact while providing the visual contrast needed for game elements to be clearly legible against the background.

```text
PROMPT (Asset 2 -- Game Board):

A bird's-eye slightly angled illustrated strategy board game map of the
Birmingham region during the Industrial Revolution. Aged parchment background
with industrial cartography style. Cities shown as clusters of Victorian brick
buildings with small smoking chimneys, canals as blue-grey waterways with canal
boats, rivers as flowing blue lines, roads as dotted brown paths, railway routes
as dark iron double lines with cross-ties, industrial districts as darker
hatched areas, countryside as lighter textured regions. Major connection routes
between cities clearly visible. Victorian architectural landmarks identifiable.
Clearly separated regions with clean boundaries for interactive element
placement. Subtle compass rose and scale bar in corners. Cinematic, atmospheric,
highly detailed, premium strategy board game, realistic concept art, tactile
materials, sophisticated composition, historical industrial setting
--ar 16:10 --style raw --v 6.1 --s 750
```

### 4.4 Asset 3: City Artwork Cards

Each city in the original board game requires a distinctive illustration for its location card. The game features approximately twenty distinct city locations, each of which must be visually identifiable while sharing the same art direction. The elevated perspective provides a sense of place and scale, showing the industrial character of each city while maintaining the card-format framing. Cities should vary in their dominant industry, architectural density, and relationship to waterways, ensuring that players can distinguish between them at a glance while recognizing them as part of the same visual system.

```text
PROMPT (Asset 3 -- City Card Template):

A Victorian industrial city during the Industrial Revolution shown from an
elevated perspective. [CITY NAME] featuring [DISTINGUISHING FEATURE: e.g.,
dense canal network / dominant pottery kilns / massive ironworks / central
railway junction]. Factories, warehouses, and brick buildings with smoking
chimneys, workers in Victorian attire, canals with boats, industrial
infrastructure, coal smoke drifting upward. Visually distinct identity while
maintaining cinematic atmospheric highly detailed premium strategy board game
art direction. Dark charcoal background with warm amber factory glow. Muted
cream parchment surface area at bottom for text overlay. Realistic concept art,
tactile materials, sophisticated composition, historical industrial setting
--ar 3:2 --style raw --v 6.1 --s 750
```

To generate the full set of city cards, replace `[CITY NAME]` and `[DISTINGUISHING FEATURE]` with city-specific details. For example, Birmingham itself should emphasize the dense clustering of multiple industries; Walsall should emphasize leather workshops and smaller-scale manufacturing; Wolverhampton should emphasize its railway junction and ironworks; and Dudley should emphasize its limestone quarries and canal intersections. Each variation should be generated with the same seed reference to maintain stylistic consistency.

### 4.5 Asset 4: Industry Tiles

Industry tiles are the core interactive components of the game board. Each tile represents one of six industry types: Coal Mine, Iron Works, Cotton Mill, Manufacturer, Pottery, and Brewery. The tiles must look like premium physical tabletop components, as though crafted from aged wood with brass fittings, printed parchment labels, and embossed industrial markings. The 1:1 aspect ratio ensures they can be placed uniformly on the game board grid. Each industry type must be immediately recognizable through its distinctive visual iconography while maintaining the consistent material language and framing of the tile system.

```text
PROMPT (Asset 4 -- Industry Tiles):

A premium board game industry tile for [INDUSTRY: Coal Mine / Iron Works /
Cotton Mill / Manufacturer / Pottery / Brewery] from a Victorian industrial
strategy board game. The tile looks like a physical tabletop component made from
aged wood with brass corner fittings, a printed parchment center showing an
illustration of [INDUSTRY-SPECIFIC SCENE: e.g., a coal mine entrance with miners
and cart tracks / a foundry with molten iron and workers / a cotton mill with
spinning mules and looms], embossed industrial markings around the border in
brass relief, subtle Victorian typography. Consistent framing and visual
hierarchy with a central circular or hexagonal illustration area. Dramatic
studio lighting, dark charcoal background, warm amber brass highlights.
Cinematic, atmospheric, highly detailed, premium strategy board game, realistic
concept art, tactile materials --ar 1:1 --style raw --v 6.1 --s 750
```

### 4.6 Asset 5: Playing Cards

Playing cards in the original board game represent either industry types or city locations and are the primary interface through which players make strategic decisions. Each card must feature a decorative Victorian border, an industrial illustration in the upper portion, and a clean text area in the lower portion where the website will overlay actual HTML text showing the card name and rules information. The 2:3 aspect ratio matches standard playing card proportions. The historical engraving-inspired artwork should evoke the technical illustration style of the period, as found in Victorian engineering publications and industrial exhibition catalogs.

```text
PROMPT (Asset 5 -- Playing Cards):

A Victorian-era playing card from a premium industrial strategy board game set
in Birmingham. Decorative Victorian border with brass and copper ornamental
scrollwork, an industrial illustration of [CARD-SPECIFIC SCENE] rendered in
historical engraving style in the upper two-thirds of the card. Subtle aged
paper texture throughout. Below the illustration, a clean muted cream parchment
area with no text, reserved for HTML text overlay. Brass and copper accent
details at corners and along the border. Dark charcoal background visible around
the card edges. Cinematic, atmospheric, highly detailed, premium strategy board
game, realistic concept art, tactile materials, sophisticated composition,
historical industrial setting --ar 2:3 --style raw --v 6.1 --s 750
```

### 4.7 Asset 6: Resource Icons

Resource icons represent the six types of physical goods that players produce, consume, and trade throughout the game: Coal, Iron, Beer, Money, Cotton, and Manufactured Goods. Each icon must be immediately recognizable at small sizes while maintaining the premium, tactile aesthetic of the broader art direction. The icons should look like physical game components photographed or illustrated under dramatic studio lighting, with a slightly three-dimensional appearance that suggests they could be picked up and placed on the board. The transparent-looking isolated compositions allow the icons to be placed on any background without visible edge artifacts.

```text
PROMPT (Asset 6 -- Resource Icons):

A highly detailed icon of [RESOURCE: Coal lump with glossy black surface and
subtle mineral veins / Iron ingot with warm metallic sheen and industrial
casting marks / Beer in a Victorian amber glass bottle with brass cap / Stack of
Victorian-era banknotes and coins / Bale of raw white cotton with textile
texture / Finished manufactured goods in a wooden crate with brass fittings],
appearing as a physical board game component photographed under dramatic studio
lighting. Isolated on a dark charcoal background with subtle reflection. Highly
detailed, tactile material quality, premium strategy board game aesthetic, warm
amber side-lighting, macro photography perspective, shallow depth of field
--ar 1:1 --style raw --v 6.1 --s 750
```

### 4.8 Asset 7: Canal and Railway Connections

Connection pieces represent the canals and railways that players build to link their industries to markets and merchants. These are among the most frequently placed components in the game, so they must be visually simple, elegant, and immediately distinguishable from each other. Canal links should evoke water, wood, and early industrial engineering, while railway links should evoke iron, steam, and Victorian-era rail infrastructure. Both should look like physical pieces designed to be placed on a tabletop board, with a sense of weight and materiality that makes them feel satisfying to manipulate.

```text
PROMPT (Asset 7 -- Connections):

An elegant board game connection piece for [TYPE: a canal link / a railway
link] from a premium Victorian industrial strategy board game. [IF CANAL: A
narrow water channel made of aged dark wood with brass rivets, containing a thin
strip of reflective blue-grey water, with small Victorian-era canal boat
silhouette] [IF RAILWAY: Two parallel dark iron rails on aged wooden sleepers
with brass fishplates at joints, subtle steam wisps]. Appears as a physical
tabletop game piece placed on a board. Dark metal, brass, iron, aged wood,
subtle highlights. Isolated on dark charcoal background. Cinematic, atmospheric,
highly detailed, premium strategy board game, realistic concept art, tactile
materials --ar 3:1 --style raw --v 6.1 --s 750
```

### 4.9 Asset 8: Player Tokens

Player tokens must be visually distinct at a glance while sharing the same material language and premium quality. Each of the four tokens should have a unique silhouette inspired by Victorian industrial motifs: a factory, a locomotive, a bridge, and a canal boat, for example, each rendered as a small brass or copper sculptural piece with slightly weathered surfaces that suggest age and use. The 1:1 format and simple backgrounds ensure they can be cleanly overlaid on the game board at any position.

```text
PROMPT (Asset 8 -- Player Tokens):

A premium board game player token from a Victorian industrial strategy board
game. [TOKEN VARIANT 1: A small brass factory silhouette with a tall chimney and
gear detail] [VARIANT 2: A copper locomotive silhouette with steam wisps]
[VARIANT 3: An iron bridge silhouette with arched span] [VARIANT 4: A brass
canal boat silhouette with cargo]. The token appears as a physical piece with
slightly weathered brass or copper construction, Victorian industrial design,
subtle patina. Isolated on a clean dark charcoal background with minimal shadow.
Cinematic, atmospheric, highly detailed, premium strategy board game, realistic
concept art, tactile materials --ar 1:1 --style raw --v 6.1 --s 750
```

### 4.10 Asset 9: Era Transition Artwork

The era transition is one of the most dramatic moments in the original board game, marking the shift from the Canal Era to the Rail Era. The artwork for this transition must convey a sense of industrial transformation and progress: canals giving way to railways, horse-drawn transport being replaced by steam locomotives, and the landscape of Birmingham being reshaped by iron and steam. This image will be displayed full-screen during the transition, so it must be compositionally dramatic and visually striking at large scale.

```text
PROMPT (Asset 9 -- Era Transition):

A cinematic wide dramatic artwork showing the transformation from the Canal Era
to the Railway Era in Victorian Birmingham. On the left, peaceful canals with
horse-drawn boats and early brick factories. In the center, explosive industrial
expansion with construction, smoke, and molten metal. On the right, a gleaming
railway era with a steam locomotive crossing an iron bridge, expanding factories
with tall chimneys, and a glowing industrial cityscape at dusk. Steam and coal
smoke drift across the entire composition connecting the three phases. Moody
atmospheric lighting transitioning from soft dawn light on the left to dramatic
amber industrial glow on the right. Cinematic, atmospheric, highly detailed,
premium strategy board game, realistic concept art, tactile materials,
sophisticated composition, historical industrial setting
--ar 16:9 --style raw --v 6.1 --s 750
```

### 4.11 Asset 10: Loading Screen

The loading screen is displayed while the game initializes and assets are streamed. It must be visually compelling on its own while incorporating central negative space where the game title and loading progress indicator can be displayed. The dark, cinematic composition creates anticipation for the gameplay experience and reinforces the premium quality of the product. Subtle atmospheric particles, such as floating coal dust or steam wisps, can add visual interest without distracting from the central title area.

```text
PROMPT (Asset 10 -- Loading Screen):

A dark cinematic Victorian industrial loading screen composition. Birmingham
skyline silhouette with factory chimneys and church spires against a deep
twilight sky. Steam rising from chimneys, railway tracks in the foreground with
subtle perspective, brass mechanical gear details visible along the bottom edge.
Subtle atmospheric particles of coal dust and steam drifting through the scene.
Central area of clean negative space for game title and loading indicator. Moody
atmospheric lighting with subtle amber brass illumination from factory windows
against dark charcoal blue sky. Cinematic, atmospheric, highly detailed, premium
strategy board game, realistic concept art, tactile materials, sophisticated
composition --ar 16:9 --style raw --v 6.1 --s 750
```

### 4.12 Complete Asset Prompt Summary

| Asset | Aspect Ratio | Key Visual Requirement | MJ Parameters |
| --- | --- | --- | --- |
| Website Hero | 16:9 | Establishing shot, negative space for UI overlay | `--ar 16:9 --s 750 --v 6.1` |
| Game Board Background | 16:10 | Bird's-eye map, separated regions for HTML overlay | `--ar 16:10 --s 750 --v 6.1` |
| City Artwork Cards | 3:2 | Elevated perspective, distinct identity per city | `--ar 3:2 --s 750 --v 6.1` |
| Industry Tiles | 1:1 | Physical tabletop component, aged wood and brass | `--ar 1:1 --s 750 --v 6.1` |
| Playing Cards | 2:3 | Victorian border, clean text area for HTML overlay | `--ar 2:3 --s 750 --v 6.1` |
| Resource Icons | 1:1 | Studio-lit physical component, isolated | `--ar 1:1 --s 750 --v 6.1` |
| Canal/Railway Links | 3:1 | Physical tabletop pieces, dark metal and wood | `--ar 3:1 --s 750 --v 6.1` |
| Player Tokens | 1:1 | Unique silhouettes, weathered brass/copper | `--ar 1:1 --s 750 --v 6.1` |
| Era Transition | 16:9 | Left-to-right evolution: canals to railways | `--ar 16:9 --s 750 --v 6.1` |
| Loading Screen | 16:9 | Dark cinematic, central negative space | `--ar 16:9 --s 750 --v 6.1` |

Table 1: Complete Asset Prompt Reference Matrix

## 5. Abstract Kinetic Art: Visual Concept and Code Prompts

This section provides the master prompts for generating the abstract kinetic art vision of the the original board game digital platform. This vision reimagines the traditional board game as a contemporary art installation, transforming the gameplay into an encounter with light, material, and spatial transformation. The section is divided into two parts: the visual concept prompt for AI image and video generators, and the playable code prompt for building the interactive 3D web experience using Three.js and WebGL.

### 5.1 Master Visual Concept Prompt

The following prompt is designed for Midjourney v6.1, DALL-E 3, or Stable Diffusion to generate the core visual concept of the abstract kinetic board game. It references specific contemporary artists to anchor the aesthetic in recognizable art-world precedents and includes technical rendering specifications to ensure the output achieves the desired level of visual quality and photorealism. The prompt is written in natural language, which is the preferred approach for Midjourney v6.1, as the model responds better to descriptive sentences than to comma-separated keyword lists.

```text
MASTER VISUAL CONCEPT PROMPT:

An interactive 3D board game reimagined as a high-end contemporary kinetic art
installation inspired by the Industrial Revolution. The board is not flat, but
a sprawling non-Euclidean topographic landscape made of frosted glass, polished
obsidian, and iridescent metallic alloys in warm brass and copper tones. The
game pieces are abstract floating geometric sculptures evoking the styles of
Olafur Eliasson, Zaha Hadid, and Anish Kapoor, with industrial undertones
suggesting Victorian machinery and brass gears. Pieces levitate using visible
magnetic field lines that glow with warm amber light. The board's surface
ripples like a liquid mirror when interacted with, revealing caustic
reflections of industrial patterns beneath. Volumetric lighting, caustic
reflections, bioluminescent amber and copper accents cutting through deep
cinematic charcoal shadows. Steam and particle effects drift through the scene
like industrial atmosphere. Unreal Engine 5 render, Octane render, ray tracing,
macro photography perspective, hyper-detailed, masterpiece, avant-garde spatial
design, UI elements floating as holographic light trails with Victorian brass
fittings --ar 16:9 --style raw --v 6.1 --s 750
```

### 5.2 Video Generation Extension

When using video AI platforms such as OpenAI's Sora or Runway Gen-3, the visual concept prompt should be extended with motion and camera instructions that bring the static concept to life. The video extension should specify camera movement, object animation, particle effects, and temporal transitions that demonstrate the interactive, kinetic nature of the installation. The following extension should be appended to the master visual concept prompt when generating video content.

```text
VIDEO EXTENSION (append to master prompt for Sora / Runway):

Smooth cinematic camera pan across the board from a low angle, revealing the
full topographic landscape. A brass geometric game piece levitates and glides
along a curved parabolic path to an adjacent tile, leaving a trail of glowing
amber particles. The tile pulses with warm copper light upon the piece's
arrival and morphs from a cube to an octahedron. Caustic light patterns ripple
across the frosted glass surface. Steam and particle effects drift through the
scene. The camera slowly orbits the board, revealing depth and scale.
Photorealistic, 4K, 60fps cinematic quality.
```

### 5.3 Master Playable Code Generation Prompt

The following prompt is designed for ChatGPT-4, Claude, or an AI coding assistant such as Cursor to generate the complete interactive 3D web experience. It specifies the artistic vision, technical architecture, shader requirements, animation system, and gameplay mechanics in sufficient detail for an AI coding assistant to produce a functional, visually impressive prototype. The prompt references specific technologies and libraries that have been validated through research into modern WebGL development practices.

```text
MASTER CODE GENERATION PROMPT:

Act as a world-class Creative Technologist and 3D WebGL Artist, combining the
sensibilities of Refik Anadol's data-driven installations with high-end game
design. Design and write the complete code for a fully 3D, interactive, abstract
board game using Three.js (or React Three Fiber with @react-three/fiber and
@react-three/drei).

ARTISTIC VISION:
The visuals must be a marvel of abstraction inspired by the Industrial
Revolution. The board should be a cluster of floating, kinetic geometric islands
made of frosted glass, polished obsidian, and iridescent brass/copper alloys.
Game pieces should be abstract volumetric light forms, liquid metal, or floating
crystalline structures that evoke Victorian machinery. Use custom GLSL shaders
for iridescence, warm brass glow, and fluid distortion. The aesthetic should
feel like a modern art museum installation meets a premium Victorian industrial
strategy game.

TECHNICAL REQUIREMENTS:
1. Setup a Three.js scene with OrbitControls (enable damping, min/max distance,
   pan limits) so the user can rotate, zoom, and pan around the 3D board.
2. Implement Raycasting (via React Three Fiber's built-in pointer events or
   Three.js Raycaster) so the user can click on floating pieces and board tiles.
3. Create smooth organic animations using GSAP (gsap.to with ease:
   "power3.inOut") so pieces hover/breathe with a subtle sine wave, and when
   clicked they glide along a curved parabolic path (using CubicBezierCurve3)
   to a new tile.
4. Provide complete custom ShaderMaterial GLSL code for iridescent board tiles
   using thin-film interference (based on Belcour and Barla 2017) with warm
   brass/copper color shifts.
5. Include dramatic lighting: a dim ambient light (0x1a1a2e), a high-contrast
   warm directional light (0xffd700, intensity 2), and PointLights (0xff8c00)
   that emit from game pieces themselves.
6. Implement a bloom post-processing pass using @react-three/postprocessing
   (EffectComposer, BloomEffect) for the glow aesthetic.

GAMEPLAY MECHANICS (Abstracted):
- Define a simple hex-grid movement rule: pieces can move to adjacent floating
  tiles.
- When a piece lands on a tile, the tile pulses with light (emissive animation
  via GSAP) and morphs its geometry (e.g., BoxGeometry to OctahedronGeometry
  using morphTargets or geometry swap).
- Include four player tokens with distinct brass/copper/gold/iron metallic
  colors.

SPATIAL AUDIO:
- Integrate the Web Audio API with PannerNode for 3D spatial audio. Play deep
  resonant bass tones when pieces move and crystalline chimes when tiles
  transform. Audio sources should be positioned at the 3D coordinates of the
  game objects.

Provide the complete single-file HTML/JS (or React component) containing the
Three.js scene, custom GLSL shaders, interaction logic, animations, and audio.
Make it visually breathtaking and functional.
```

### 5.4 Custom Shader Technical Specifications

The iridescent board tile shader is the single most important visual element in the abstract kinetic art vision. It must produce a thin-film interference effect that shifts between warm brass, copper, and gold tones depending on the viewing angle, creating the impression that each tile is made from an actual iridescent metallic alloy. The implementation is based on the thin-film iridescence approach described by Belcour and Barla in their 2017 SIGGRAPH paper, which models the optical interference patterns produced by thin transparent films on reflective surfaces. This technique has been validated in the Three.js ecosystem through the open-source threejs-thin-film-iridescence library.

The vertex shader should pass the world-space normal, view direction, and surface position to the fragment shader as varyings. The fragment shader should compute the fresnel angle between the view direction and the surface normal, use this angle to sample a pre-computed thin-film lookup texture (as provided by the threejs-thin-film-iridescence library), and blend the resulting iridescent color with a base brass/copper albedo. The shader should also accept a uniform float for animation time, which drives a subtle wave distortion in the normal calculation to produce the liquid-mirror rippling effect when the board is interacted with. An emissive component, controlled by a separate uniform, enables the tile pulse effect when a piece lands on it.

For the game pieces, a separate volumetric light shader should be implemented that produces the effect of a glowing, semi-transparent crystalline structure. This can be achieved using a combination of additive blending, a noise-based density function in the fragment shader, and a fresnel-based edge glow effect. The shader should accept uniforms for the piece's base color (brass, copper, gold, or iron), its glow intensity, and its animation phase. The noise function should produce organic, flowing patterns that suggest internal energy or industrial processes, consistent with the Victorian industrial theme reimagined through an abstract lens.

### 5.5 Spatial Audio Integration

Spatial audio is a critical but frequently overlooked component of abstract interactive experiences. The Web Audio API provides native support for 3D audio spatialization through the PannerNode interface, which uses head-related transfer functions (HRTFs) to simulate how sound waves interact with the human head and ears, creating the perception of sound position in three-dimensional space. This technology has been validated for browser-based applications and is supported by all modern browsers, including Chrome, Firefox, Safari, and Edge. The MDN Web Docs provide comprehensive documentation on the Web Audio API's spatialization capabilities, including the PannerNode's distance and cone models that control how sound attenuates and focuses in 3D space.

For the the original board game abstract experience, the audio design should complement the visual aesthetic. When a piece levitates and moves to a new tile, a deep, resonant bass tone should play, with the sound source positioned at the piece's 3D coordinates and panning naturally as the piece moves through space. When a tile transforms upon receiving a piece, a crystalline chime should play, positioned at the tile's 3D coordinates. A low, ambient drone should provide atmospheric bed, and the overall mix should feel like the sonic equivalent of the visual aesthetic: warm, metallic, industrial, and contemplative. Audio assets can be sourced from Freesound's Creative Commons library or generated programmatically using the Web Audio API's oscillator and filter nodes.

## 6. Prompt Engineering Best Practices

### 6.1 Midjourney v6.1 Parameter Reference

Midjourney v6.1 represents a significant evolution in prompting methodology compared to v5 and earlier versions. The model is much more sensitive to natural language and responds poorly to the keyword-stacking approach that was effective in v4 and v5. Descriptive sentences with clear subject-verb-object structure produce better results than comma-separated lists of adjectives. The model also has a much stronger understanding of spatial relationships, material properties, and lighting conditions, allowing prompts to specify these attributes with greater precision and nuance. The following table documents the key parameters used throughout this document's prompt specifications.

| Parameter | Value | Purpose | Notes |
| --- | --- | --- | --- |
| `--ar` | 16:9 / 16:10 / 3:2 / 2:3 / 1:1 / 3:1 | Aspect ratio control | Place at end of prompt; no punctuation in parameter block |
| `--v` | 6.1 | Model version | Default in v6.1; explicit for clarity |
| `--style` | raw | Reduced Midjourney beautification | Produces more photorealistic, less painterly results |
| `--s` | 750 | Stylize value (0-1000) | 750 balances Midjourney aesthetics with prompt adherence |
| `--c` | 0-100 | Chaos value | Higher values increase variation across a batch |
| `--tile` | N/A | Seamless tiling | Useful for texture generation for board surfaces |

Table 2: Midjourney v6.1 Parameter Reference

### 6.2 Cross-Platform Adaptation Guidelines

While the prompts in this document are optimized for Midjourney v6.1, they can be adapted for other platforms with specific modifications. For DALL-E 3, remove all Midjourney-specific parameters (`--ar`, `--style`, `--v`, `--s`) and rewrite the prompt in a more conversational, descriptive tone, as DALL-E 3 responds well to natural language narratives. Aspect ratio can be controlled through DALL-E 3's native image size options. For Stable Diffusion, the prompts should be converted to a weighted tag-based format using parentheses for emphasis, such as `(cinematic:1.3)`, `(atmospheric lighting:1.2)`, and negative prompts should be explicitly defined to exclude the items listed in the Avoid section of the Universal Art Direction Anchor. For Stable Diffusion, a LoRA model trained on Victorian industrial architecture can significantly improve consistency across multiple generations.

When working across multiple platforms, it is recommended to generate a single reference image in Midjourney using the Universal Art Direction Anchor prompt and then use that image as a style reference (using Midjourney's `--sref` parameter or DALL-E 3's image prompt feature) for all subsequent asset generations. This technique creates a visual anchor that dramatically improves cross-asset consistency regardless of the platform used. For video generation with Sora or Runway, the visual concept prompt should be supplemented with specific camera movement, object animation, and temporal transition instructions, as detailed in Section 5.2.

## 7. Pro-Tips for Elevating Results

### 7.1 Reference Real Masters of Art and Design

If the AI generates output that feels too generic or too similar to standard game art, redirect it by referencing specific contemporary artists whose work embodies the desired quality. Olafur Eliasson is the primary reference for the abstract vision: his installations, such as "The Weather Project" at the Tate Modern, demonstrate how simple materials like fog, mirrors, and mono-frequency light can create overwhelming atmospheric experiences. His work with caustic reflections and optical phenomena directly informs the liquid-mirror board surface and volumetric lighting specifications. Anthony Gormley's sculptural work, particularly his "Cloud Gate" in Chicago (colloquially known as "The Bean"), demonstrates how reflective metallic surfaces can create distorted, dreamlike reflections of the surrounding environment, informing the iridescent tile shader approach.

Zaha Hadid's parametric architecture provides the reference for the board's non-Euclidean topology: her buildings flow and curve in ways that seem to dissolve the boundaries between solid and void, interior and exterior. When the AI generates tiles or board layouts that look too grid-like or rectilinear, invoking Hadid's name encourages more fluid, organic spatial compositions. Refik Anadol's data-driven AI art installations, which transform vast datasets into flowing, organic visualizations of light and motion, provide the reference for the particle effects, procedural animations, and the overall sense that the board is a living, data-driven organism rather than a static playing surface. For the Victorian Industrial Realism assets, referencing historical painters of the Industrial Revolution, such as Joseph Mallord William Turner's atmospheric industrial landscapes and Philip James de Loutherbourg's dramatic industrial scenes, can help the AI achieve the desired historical atmosphere and painterly lighting quality.

### 7.2 Physics of the Abstract: Levitation, Orbit, and Phase

The most impactful differentiator between a standard digital board game and a marvellous abstract experience is the behavior of game pieces. In a standard implementation, pieces slide from one position to another along a flat surface, obeying basic friction and gravity. In the abstract kinetic vision, pieces should levitate, orbit, and phase into new spaces. This means that when a piece moves, it should first rise upward along the Y-axis, then arc through three-dimensional space along a parabolic or spline curve to its destination, and finally descend gently into position. The movement should leave a trail of glowing particles, and the board surface should ripple in response to the piece's passage as though the piece were a stone dropped into a pond.

This behavior should be specified in the code generation prompt using GSAP's timeline feature, which allows multiple animations to be sequenced and overlapped with precise timing control. The piece's hover state should use a sine wave function applied to the Y position, creating a gentle breathing effect that makes every piece on the board feel alive and in motion even when no player interaction is occurring. The phase offset of the sine wave should be unique to each piece, preventing the visual monotony of synchronized hovering. These details, while subtle, collectively transform the experience from a functional game interface into a contemplative, museum-quality kinetic sculpture.

### 7.3 Audio as Fifty Percent of Abstraction

Sound design is frequently the most neglected aspect of digital board game development, yet it is arguably the single most effective tool for transforming a visual experience into an immersive one. Research into game audio design consistently demonstrates that audio accounts for approximately fifty percent of the perceived quality of an interactive experience. For the abstract kinetic vision, the audio design should be as deliberate and refined as the visual design. The Web Audio API provides all the tools necessary for sophisticated spatial audio without any external dependencies: oscillators for generating synthetic tones, filters for shaping timbre, convolvers for adding reverb and spatial characteristics, and PannerNodes for positioning sounds in 3D space.

The recommended audio palette consists of three layers. The base layer is a low, sustained ambient drone created by a filtered sawtooth oscillator with subtle LFO modulation, providing a warm, industrial bed that fills the sonic space without demanding attention. The event layer consists of short, triggered sounds that respond to player actions: deep, resonant bass tones when pieces move (created by sine oscillators with exponential frequency envelopes), crystalline chimes when tiles transform (created by high-frequency sine oscillators with fast attack and long reverb tails), and subtle mechanical clicks when the camera orbits (created by noise bursts with bandpass filtering). The detail layer consists of continuous, procedural sounds that add richness: subtle vinyl crackle or steam hiss that varies with the board state, providing the sense that the environment is alive and industrially active even during quiet moments.

### 7.4 Iterative Refinement Workflow

Achieving a cohesive visual system through AI image generation is an iterative process that requires deliberate workflow management. The recommended approach is to generate the Universal Art Direction Anchor prompt first and produce a set of four to eight reference images. From these, select the single image that best embodies the desired aesthetic and use it as a style reference (via Midjourney's `--sref` parameter) for all subsequent asset generations. This creates a visual DNA that anchors every generation to the same aesthetic, dramatically reducing the variation that typically occurs when generating assets independently.

For each asset category, generate a batch of four variations and select the best one. Then, using that selected image as a character reference (`--cref` in Midjourney), generate the remaining assets in that category. This two-stage approach, first establishing a category-level reference and then generating individual assets from it, ensures consistency both within and across asset categories. After all assets are generated, review the complete set as a composite to identify any outliers that break the visual consistency, and regenerate those specific assets with more explicit style-matching instructions. This workflow typically requires three to four passes to achieve a production-quality result, but it produces a level of consistency that is difficult to achieve through single-pass generation.

## 8. Consistency and Quality Assurance

Visual consistency is the primary quality challenge when generating a complete board game asset pack through AI image generation. Each asset is generated independently, and even with identical style prompts, the stochastic nature of diffusion models means that outputs will vary in lighting, color temperature, material rendering, and level of detail. This section defines the quality assurance process for ensuring that the final asset pack meets the cohesive visual standard required for a premium product.

The quality assurance checklist for each generated asset should verify the following criteria. First, material palette compliance: does the asset use only the approved materials (brick, brass, copper, aged wood, parchment, iron, coal, steam) and avoid prohibited materials (neon, chrome, plastic, modern glass)? Second, lighting language compliance: does the asset use the moody atmospheric lighting defined in the art direction, with warm amber highlights and deep charcoal shadows, or has the AI introduced flat, uniform, or oversaturated lighting? Third, period accuracy: does the asset contain only Victorian-era architecture, technology, and costume, or have anachronistic elements been introduced? Fourth, functional adequacy: for assets that require negative space or clean areas for HTML overlay, is that space actually clean and usable?

| Quality Criterion | Verification Method | Pass Threshold |
| --- | --- | --- |
| Material palette compliance | Visual inspection against approved materials list | Zero prohibited materials present |
| Lighting language compliance | Compare against Universal Art Direction reference | Matches warm amber/charcoal language |
| Historical period accuracy | Check for anachronistic elements | Zero post-1900 elements |
| Negative space usability | Overlay HTML elements at target resolution | All UI elements readable without conflict |
| Cross-asset consistency | Compare side-by-side with reference set | No visual outlier in color, detail, or style |
| Resolution and sharpness | Check at target display resolution | Sharp at 1920x1080 minimum |
| Aspect ratio correctness | Measure pixel dimensions | Within 1% of target ratio |

Table 3: Quality Assurance Checklist

## 9. Legal and Ethical Considerations

The use of AI-generated art in commercial products raises important legal and ethical questions that must be addressed before any generated assets are incorporated into the the original board game digital platform. The U.S. Copyright Office's 2025 report on copyrightability and AI, along with its three-part examination of AI and copyright, establishes that purely AI-generated outputs, absent meaningful human creative input, lack the necessary authorship required for copyright protection under U.S. law. This means that AI-generated images cannot be copyrighted in their own right, which has significant implications for a commercial product that relies on these images as core visual assets.

To mitigate legal risk, the recommended approach is to use AI-generated images as reference material and starting points for human-created final assets, rather than using them directly in the product. A human artist should review, modify, and finalize each generated asset, contributing sufficient creative input to establish copyrightable authorship. The AI-generated output provides the initial composition, color palette, and material direction, but the human artist refines the details, corrects any historical inaccuracies, ensures cross-asset consistency, and adds the finishing touches that transform a generated image into a production-quality game asset. This hybrid approach, where AI serves as an accelerator for human creativity rather than a replacement for it, is the legally and ethically sound path for commercial game development.

Additionally, the referencing of specific living artists such as Olafur Eliasson, Zaha Hadid, and Refik Anadol in the prompts raises the question of whether generated outputs that closely mimic a particular artist's style could constitute derivative works. While current legal precedent is unsettled in this area, the prompts in this document use these artist references as directional guides for aesthetic qualities (light, space, material) rather than as instructions to replicate specific artworks. The prompts explicitly combine these references with the distinct theme of the Industrial Revolution and the specific visual language of the original board game, ensuring that the generated outputs are transformative rather than imitative. Developers should nonetheless consult with legal counsel before publishing any AI-generated or AI-assisted visual assets in a commercial product.

## 10. References

1. Roxley Games. *the original board game Official Rulebook.* Roxley Games, 2018.
2. Midjourney. *Midjourney Parameter List.* https://docs.midjourney.com/hc/en-us/articles/32859204029709-Parameter-List. Accessed August 2026.
3. Midlibrary. *Midjourney V6 In-Depth Review, Part 2: Prompting.* https://midlibrary.io/midguide/midjourney-v6-in-depth-review-part-2-prompting. Accessed August 2026.
4. ImageToPrompt. *Midjourney Prompts Guide 2026.* https://www.imagetoprompt.dev/blog/midjourney-prompt-guide-2026. Accessed August 2026.
5. Three.js. *ShaderMaterial Documentation.* https://threejs.org/docs/pages/ShaderMaterial.html. Accessed August 2026.
6. DerSchmale. *threejs-thin-film-iridescence (MIT License).* https://github.com/DerSchmale/threejs-thin-film-iridescence. Accessed August 2026.
7. Maxime Heckel. *The Study of Shaders with React Three Fiber.* https://blog.maximeheckel.com/posts/the-study-of-shaders-with-react-three-fiber. Accessed August 2026.
8. pmndrs. *React Three Fiber Events and Interaction Tutorial.* https://r3f.docs.pmnd.rs/tutorials/events-and-interaction. Accessed August 2026.
9. MDN Web Docs. *Web Audio API: Web Audio Spatialization Basics.* https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Web_audio_spatialization_basics. Accessed August 2026.
10. GSAP. *Animating Three.js Objects with GSAP.* https://gsap.com/community/forums/topic/29721-threejs-and-gsap. Accessed August 2026.
11. Atomic Object. *Create Sick Web Animations in Three.js with GSAP.* https://spin.atomicobject.com/animations-threejs-gsap. Accessed August 2026.
12. U.S. Copyright Office. *Copyright and Artificial Intelligence, Part 2: Copyrightability.* January 2025. https://www.copyright.gov/ai. Accessed August 2026.
13. Davies Collison Cave. *Generative AI vs The Artist: The Changing Face of Board Game Design.* May 2024. https://dcc.com/news-and-insights/generative-ai-vs-the-artist. Accessed August 2026.
14. Mindclash Games. *Illustration in Board Games: The Power of Visual Storytelling.* January 2026. https://mindclashgames.com/news/illustration-in-board-games. Accessed August 2026.
15. Codrops. *Building a Scroll-Driven 3D Gallery Using a Blender Camera Path with Three.js and GSAP.* July 2026. https://tympanus.net/codrops/2026/07/07/building-a-scroll-driven-3d-gallery. Accessed August 2026.
