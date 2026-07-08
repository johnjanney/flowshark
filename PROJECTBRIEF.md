# Project Brief: Windows ARM Flowchart Application

## 1. Project Overview

Build a native-feeling flowchart application optimized for Windows on ARM. The application should provide a simple, approachable user experience while supporting the core feature set expected from a top-tier diagramming and flowchart tool.

The product should allow users to quickly create, edit, style, align, connect, export, and manage professional flowcharts using a rich set of shapes, connectors, labels, colors, borders, line styles, snapping, and layout tools.

## 2. Product Goal

Create a lightweight but comprehensive flowchart application for Windows ARM that combines ease of use with professional diagramming capabilities.

The application should be suitable for:

- Business process mapping
- System flow diagrams
- Decision trees
- Organizational workflows
- User journey flows
- Software logic diagrams
- Operational process documentation
- Training and instructional diagrams
- Strategic planning diagrams

## 3. Target Platform

### Primary Platform

- Windows 11 on ARM

### Secondary Compatibility Goal

- Windows 11 x64, if practical, through shared codebase or cross-compilation

### Performance Expectations

- Fast startup time
- Smooth pan and zoom
- Responsive dragging, resizing, connecting, snapping, and text editing
- Efficient rendering of diagrams with hundreds of elements
- Touchpad, mouse, pen, and touchscreen-friendly interactions where feasible

## 4. Target Users

Primary users include business professionals, consultants, managers, analysts, educators, software planners, operations teams, and non-technical users who need to create clear process diagrams without a steep learning curve.

Secondary users include technical teams, developers, architects, and power users who need richer connector, layout, export, and formatting capabilities.

## 5. Core Product Principles

1. **Simple by default**  
   Users should be able to create a basic flowchart within minutes.

2. **Comprehensive when needed**  
   Advanced formatting, connector, alignment, and layout tools should be available without overwhelming the basic workflow.

3. **Professional output**  
   Diagrams should look polished enough for presentations, reports, documentation, and client deliverables.

4. **Fast and native-feeling**  
   The application should feel responsive and well-integrated with Windows.

5. **Predictable editing behavior**  
   Moving, resizing, connecting, snapping, grouping, and aligning elements should behave consistently.

## 6. MVP Scope

The MVP should include a complete single-user diagram editor with essential flowchart creation, styling, layout, import/export, and file management features.

### MVP Must Include

- Canvas-based diagram editor
- Complete flowchart shape library
- Multiple connector types
- Shape styling
- Connector styling
- Text inside elements
- Text on connectors
- Snap-to-grid
- Snap-to-element
- Alignment tools
- Distribution tools
- Undo/redo
- Copy/paste/duplicate/delete
- Group/ungroup
- Zoom and pan
- Save/open project files
- Export to PNG, SVG, and PDF
- Basic templates
- Keyboard shortcuts

## 7. Out-of-Scope for MVP

The following may be considered for later releases:

- Real-time collaboration
- Cloud sync
- Commenting and review workflows
- AI-assisted diagram generation
- Advanced BPMN support
- Visio import/export
- Plugin marketplace
- Enterprise admin controls
- Version history
- Multi-user permissions

## 8. Functional Requirements

## 8.1 Canvas and Workspace

The application should provide a central editable canvas where users can place, connect, style, and arrange flowchart elements.

### Canvas Requirements

- Infinite or large expandable canvas
- Optional visible grid
- Toggleable snap-to-grid
- Toggleable snap-to-element
- Zoom in/out
- Fit to screen
- Fit selection
- Pan via mouse, trackpad, keyboard shortcut, and scroll gestures
- Select single object
- Multi-select objects
- Marquee selection
- Drag objects around canvas
- Resize objects with handles
- Rotate objects, if supported by rendering model
- Bring forward/send backward
- Bring to front/send to back
- Lock/unlock elements
- Hide/show elements, if layer support is included

### View Controls

- Zoom percentage control
- Minimap or page overview, optional but recommended
- Rulers, optional
- Page boundaries, optional
- Dark mode support, recommended

## 8.2 Flowchart Elements / Shape Library

The application must include a comprehensive standard flowchart shape library.

### Required Flowchart Shapes

- Process rectangle
- Decision diamond
- Start/end terminator
- Input/output parallelogram
- Document
- Multiple documents
- Manual input
- Manual operation
- Preparation
- Predefined process / subroutine
- Database / data store
- Internal storage
- Direct access storage
- Sequential access storage
- Display
- Delay
- Connector circle
- Off-page connector
- Merge
- Extract
- Sort
- Collate
- Stored data
- Annotation / note
- Callout
- Swimlane container
- Phase / section container

### Additional General Diagram Shapes

- Rectangle
- Rounded rectangle
- Circle / ellipse
- Triangle
- Diamond
- Hexagon
- Cylinder
- Cloud
- Star
- Line
- Arrow
- Text box
- Image placeholder
- Icon placeholder

### Shape Behavior

Each shape should support:

- Drag-and-drop placement
- Resize
- Move
- Duplicate
- Delete
- Copy/paste
- Style editing
- Text editing inside the shape
- Auto-size to text, optional
- Fixed-size mode, optional
- Connection points
- Snap targets
- Lock/unlock
- Group/ungroup

## 8.3 Connectors

The application must support a rich connector system similar to professional diagramming tools.

### Required Connector Types

- Straight connector
- Elbow / orthogonal connector
- Curved connector
- Step connector
- Freeform connector
- Dynamic connector that reroutes when elements move
- Fixed-point connector between explicit anchor points
- Floating connector that attaches to nearest logical point
- One-way arrow connector
- Two-way arrow connector
- No-arrow line connector
- Dashed connector
- Dotted connector
- Thick connector
- Thin connector

### Connector Endpoint Styles

- None
- Standard arrow
- Open arrow
- Filled arrow
- Diamond
- Filled diamond
- Circle
- Filled circle
- Square
- Filled square
- Bar / T endpoint

### Connector Behavior

Connectors should support:

- Drag from one shape to another
- Snap to shape boundary
- Snap to defined connection points
- Remain attached when shapes move
- Recalculate path when connected shapes are moved
- Manual adjustment handles
- Add/remove bend points
- Route around elements where feasible
- Text labels on connector lines
- Multiple labels per connector, optional
- Label repositioning along connector
- Label background fill, optional
- Connector selection and editing
- Connector deletion without deleting connected shapes

## 8.4 Text Features

### Text-in-Element

Users must be able to place and edit text inside any flowchart element.

Required features:

- Double-click to edit text
- Inline text editing
- Font family selection
- Font size
- Bold, italic, underline
- Text color
- Horizontal alignment: left, center, right
- Vertical alignment: top, middle, bottom
- Text wrapping
- Auto-fit text, optional
- Padding/margins inside shape
- Bullet and numbered lists, optional but recommended

### Text-on-Line / Connector Labels

Users must be able to add text labels to connectors.

Required features:

- Add label to connector
- Edit label inline
- Move label along connector
- Offset label from line
- Style label text
- Optional label background fill
- Optional label border
- Label should remain associated with connector when connector moves or reroutes

### Standalone Text Boxes

Users should be able to create standalone text boxes on the canvas.

Required features:

- Add text box
- Resize text box
- Style text
- Transparent or filled background
- Optional border

## 8.5 Styling and Formatting

The application must allow users to adjust visual styling at the shape, connector, and text levels.

### Shape Styling

Required controls:

- Fill color
- Fill opacity
- Border color
- Border thickness
- Border style: solid, dashed, dotted
- Corner radius where applicable
- Shadow, optional
- Gradient fill, optional
- Preset style themes
- Copy formatting / format painter, recommended

### Connector Styling

Required controls:

- Line color
- Line thickness
- Line style: solid, dashed, dotted
- Arrowhead style
- Start endpoint style
- End endpoint style
- Connector opacity
- Curvature or elbow behavior where applicable
- Bend point editing

### Text Styling

Required controls:

- Font family
- Font size
- Font weight
- Italic
- Underline
- Text color
- Text alignment
- Line spacing, optional
- Text background, optional

## 8.6 Snapping, Alignment, and Distribution

Professional layout tools are a core requirement.

### Snap-to-Grid

- Toggle on/off
- Adjustable grid size
- Visual grid display toggle
- Objects snap while moving and resizing

### Snap-to-Element

- Snap to edges
- Snap to centers
- Snap to connection points
- Snap to equal spacing guides
- Snap to alignment guides
- Visual guide lines during movement
- Adjustable snap tolerance

### Alignment Tools

Users must be able to align selected elements by:

- Left edges
- Horizontal centers
- Right edges
- Top edges
- Vertical centers
- Bottom edges

### Distribution Tools

Users must be able to distribute selected elements by:

- Horizontal spacing
- Vertical spacing
- Equal spacing between objects
- Equal center-to-center spacing

### Size Matching Tools

Recommended tools:

- Make same width
- Make same height
- Make same size

## 8.7 Object Management

### Selection

- Single select
- Multi-select
- Shift-click add/remove selection
- Drag marquee selection
- Select all
- Select connected elements, optional

### Grouping

- Group selected elements
- Ungroup grouped elements
- Move group as one object
- Resize group, optional
- Apply styles to group, optional

### Layering

At minimum:

- Bring forward
- Send backward
- Bring to front
- Send to back

Recommended:

- Layer panel
- Rename layers
- Lock layers
- Hide layers

## 8.8 Editing Commands

Required commands:

- Undo
- Redo
- Cut
- Copy
- Paste
- Duplicate
- Delete
- Select all
- Deselect
- Nudge with arrow keys
- Larger nudge with Shift + arrow keys
- Copy style
- Paste style

## 8.9 Templates and Starter Diagrams

The application should include starter templates that help users begin quickly.

### Required Templates

- Basic flowchart
- Decision tree
- Process map
- Cross-functional flowchart / swimlane
- Software logic flow
- Customer journey flow
- Approval workflow
- Incident response workflow
- Sales funnel workflow
- Project workflow

Templates should be editable after creation.

## 8.10 File Management

### Native Project Format

The application should save diagrams in a native structured project format.

Recommended format:

- JSON-based document model
- File extension such as `.flowarm`, `.flowchart`, or `.wfc`
- Versioned schema
- Embedded style definitions
- Embedded or referenced images

### Required File Operations

- New file
- Open file
- Save
- Save as
- Recent files
- Auto-save, recommended
- Recover unsaved work, recommended

## 8.11 Import and Export

### Required Export Formats

- PNG
- SVG
- PDF

### Recommended Export Formats

- JPEG
- WebP
- Markdown image reference export
- Copy as image to clipboard
- Copy as SVG to clipboard

### Export Options

- Export entire canvas
- Export selected objects
- Export visible page only
- Transparent background option for PNG/SVG
- Include or exclude grid
- Set scale/resolution
- Set page size
- Set margins

### Import Options

Recommended:

- Import SVG
- Import PNG/JPEG/WebP as image objects
- Import JSON-native project format
- Paste image from clipboard

Future consideration:

- Visio import/export
- Mermaid import/export
- Draw.io import/export

## 8.12 Keyboard Shortcuts

The application should include standard productivity shortcuts.

### Required Shortcuts

- Ctrl+N: New
- Ctrl+O: Open
- Ctrl+S: Save
- Ctrl+Shift+S: Save As
- Ctrl+Z: Undo
- Ctrl+Y or Ctrl+Shift+Z: Redo
- Ctrl+C: Copy
- Ctrl+X: Cut
- Ctrl+V: Paste
- Ctrl+D: Duplicate
- Delete/Backspace: Delete selected
- Ctrl+A: Select all
- Ctrl+G: Group
- Ctrl+Shift+G: Ungroup
- Ctrl++: Zoom in
- Ctrl+-: Zoom out
- Ctrl+0: Fit to screen
- Arrow keys: Nudge
- Shift+Arrow keys: Larger nudge

## 8.13 User Interface Requirements

The UI should be clean, modern, and familiar to users of productivity and design tools.

### Recommended Layout

- Top command bar / ribbon
- Left shape library panel
- Central canvas
- Right properties inspector
- Bottom status bar
- Optional layers panel
- Optional minimap

### Left Shape Panel

Should include:

- Search shapes
- Flowchart shape category
- General shapes category
- Connector category
- Recently used shapes
- Favorite shapes, optional

### Right Properties Panel

Should expose contextual controls for the selected object:

- Shape properties
- Fill and border
- Text formatting
- Connector settings
- Position and size
- Alignment and distribution
- Layer/order controls

### Toolbar Controls

Recommended toolbar items:

- Select tool
- Shape tool
- Connector tool
- Text tool
- Pan tool
- Zoom controls
- Fill color
- Border color
- Border thickness
- Line color
- Line thickness
- Arrow style
- Align
- Distribute
- Group
- Export

## 8.14 Accessibility Requirements

The application should be accessible to a broad range of users.

Required:

- Keyboard navigability for major functions
- Visible focus states
- High contrast support
- Screen reader labels for controls
- Scalable UI text
- Color contrast compliance for interface controls

Recommended:

- Color-blind-safe default palettes
- Diagram accessibility checker
- Alt text for exported diagrams, where applicable

## 8.15 Performance Requirements

The application should remain responsive with moderately complex diagrams.

Minimum target:

- 500 shapes and connectors on a single canvas
- Smooth drag interactions at common zoom levels
- Undo/redo stack of at least 100 actions
- Fast save/open for typical diagrams

Recommended target:

- 2,000+ diagram objects
- Hardware-accelerated rendering
- Efficient hit-testing and spatial indexing
- Lazy rendering for offscreen objects

## 8.16 Data Model Requirements

The internal document model should support:

- Document metadata
- Canvas settings
- Shape objects
- Connector objects
- Text objects
- Groups
- Layers
- Styles
- Templates
- Embedded images
- Object IDs
- Connection references
- Z-order
- Undo/redo history model

### Suggested Object Fields

Each shape should include:

- Unique ID
- Type
- Position: x, y
- Size: width, height
- Rotation
- Fill style
- Border style
- Text content
- Text style
- Connection points
- Layer ID
- Z-index
- Lock state

Each connector should include:

- Unique ID
- Connector type
- Source object ID
- Source anchor point
- Target object ID
- Target anchor point
- Path points
- Line style
- Endpoint styles
- Text labels
- Routing behavior
- Layer ID
- Z-index

## 9. Recommended Technology Direction

Final stack selection should be validated by the engineering team, but the following directions are recommended for Windows ARM.

### Option A: Native Windows Application

Potential technologies:

- WinUI 3
- Windows App SDK
- C#/.NET
- SkiaSharp or Win2D for canvas rendering

Advantages:

- Strong Windows integration
- Good ARM support
- Native-feeling UI
- Access to Windows file dialogs, clipboard, printing, and accessibility APIs

### Option B: Cross-Platform Desktop Application

Potential technologies:

- Avalonia UI with .NET
- Skia-based rendering

Advantages:

- Strong desktop UI model
- Cross-platform potential
- Good drawing surface options
- Familiar C# development model

### Option C: Web-Based Desktop Shell

Potential technologies:

- Tauri
- WebView2
- TypeScript
- Canvas/SVG rendering engine

Advantages:

- Modern UI development speed
- Easier use of web diagramming/rendering concepts
- Smaller footprint than Electron

Risk:

- Must carefully validate performance, file handling, and native feel on Windows ARM

## 10. Suggested Architecture

### Major Components

1. **Application Shell**  
   Window management, command routing, menus, settings, file operations.

2. **Canvas Engine**  
   Rendering, hit-testing, selection, drag, resize, zoom, pan, snap, and guides.

3. **Document Model**  
   Stores shapes, connectors, styles, layers, groups, metadata, and schema version.

4. **Shape Library**  
   Defines available shapes, geometry, connection points, default styles, and icons.

5. **Connector Engine**  
   Manages connector routing, anchors, bend points, labels, and arrowheads.

6. **Text Engine**  
   Handles inline editing, text layout, wrapping, measurement, and formatting.

7. **Formatting System**  
   Handles fill, stroke, text style, themes, and style presets.

8. **Command System**  
   Supports undo/redo and all user actions as reversible commands.

9. **Import/Export System**  
   Handles native format, image exports, SVG, PDF, and clipboard formats.

10. **Template System**  
   Stores and loads starter diagrams.

## 11. User Stories

### Basic Creation

As a user, I want to drag a process shape onto the canvas so I can start building a flowchart quickly.

As a user, I want to double-click a shape and type text inside it so I can label each step.

As a user, I want to connect two shapes with an arrow so I can show flow direction.

### Professional Formatting

As a user, I want to change fill color, border color, and border thickness so my diagram matches my presentation style.

As a user, I want to change connector color, line thickness, and arrowhead style so relationships are visually clear.

As a user, I want to place text on a connector so I can label decision paths such as Yes, No, Approved, or Rejected.

### Layout and Precision

As a user, I want elements to snap to nearby objects so I can create clean layouts without manually measuring positions.

As a user, I want to align selected elements to the same left edge, center, or top edge so my diagram looks organized.

As a user, I want to distribute objects evenly so my diagram spacing is consistent.

### File and Export

As a user, I want to save my diagram as a project file so I can continue editing later.

As a user, I want to export my diagram as PNG, SVG, or PDF so I can use it in documents, presentations, and websites.

## 12. Acceptance Criteria

The MVP is acceptable when a user can:

1. Create a new flowchart document.
2. Add standard flowchart shapes to the canvas.
3. Add text inside any shape.
4. Connect shapes using straight, elbow, and curved connectors.
5. Add and edit text labels on connectors.
6. Change shape fill color, border color, and border thickness.
7. Change connector color, line thickness, line style, and arrowhead type.
8. Move, resize, duplicate, delete, group, and ungroup elements.
9. Snap elements to the grid and to nearby elements.
10. Align selected elements by edge or center.
11. Distribute selected elements evenly.
12. Save and reopen a native project file.
13. Export the diagram as PNG, SVG, and PDF.
14. Use undo and redo across common editing actions.
15. Create a professional-looking diagram from a starter template.

## 13. Non-Functional Requirements

### Reliability

- File saves should be robust and avoid data loss.
- Auto-save and crash recovery are strongly recommended.
- Invalid project files should fail gracefully with useful error messages.

### Maintainability

- Use a versioned document schema.
- Keep rendering, document model, UI, and export logic modular.
- Provide test coverage for document serialization, connector routing, and command undo/redo.

### Security

- Validate imported files.
- Avoid executing code from imported diagram files.
- Sanitize SVG imports where applicable.
- Store user files locally unless cloud features are added later.

### Privacy

- No telemetry by default unless explicitly disclosed and configurable.
- If telemetry is included, provide a clear opt-out setting.

## 14. Development Milestones

### Milestone 1: Technical Prototype

- Basic app shell
- Canvas rendering
- Add/move/resize simple shapes
- Basic selection
- Basic save/load document model

### Milestone 2: Core Diagram Editor

- Full standard shape library
- Text inside shapes
- Basic connectors
- Undo/redo
- Copy/paste/delete
- Zoom and pan

### Milestone 3: Professional Formatting

- Fill, border, and text styling
- Connector styling
- Arrowhead styles
- Text-on-connector labels
- Format inspector panel

### Milestone 4: Layout Tools

- Snap-to-grid
- Snap-to-element
- Alignment guides
- Alignment commands
- Distribution commands
- Group/ungroup

### Milestone 5: Export and Templates

- PNG export
- SVG export
- PDF export
- Starter templates
- Recent files
- Keyboard shortcuts

### Milestone 6: Polish and Release Candidate

- Performance optimization
- Accessibility pass
- UI refinement
- Error handling
- Installer/package generation
- Windows ARM validation

## 15. Risks and Considerations

### Connector Routing Complexity

Dynamic connector routing can become complex, especially when routing around objects. A basic reliable implementation should come before advanced auto-routing.

### Text Editing Complexity

Inline rich text editing inside arbitrary shapes and along connectors can create unexpected complexity. Start with plain text plus basic formatting, then expand.

### Export Fidelity

SVG and PDF exports must match the on-screen diagram closely. Rendering architecture should be chosen with export fidelity in mind.

### Performance on ARM Devices

Rendering and hit-testing should be profiled on actual Windows ARM hardware, not only emulated or x64 machines.

### Scope Creep

A top-tier flowchart application can quickly expand into a full diagramming suite. The initial product should focus on flowcharts while preserving architecture for future diagram types.

## 16. Future Enhancements

Potential post-MVP features:

- Mermaid import/export
- Draw.io import/export
- Visio import/export
- AI-generated flowcharts from text prompts
- Auto-layout engine
- BPMN shape library
- UML shape library
- Org chart generator
- Data-linked diagrams
- Comments and review mode
- Cloud sync
- Real-time collaboration
- Presentation mode
- Template marketplace
- Custom shape libraries
- Brand/theme kits
- Diagram validation rules
- Accessibility checker for exported diagrams

## 17. Definition of Done

The project is complete for MVP release when:

- All MVP functional requirements are implemented.
- The application runs natively or smoothly on Windows ARM.
- Core editing actions are stable and undoable.
- Diagrams can be saved, reopened, and exported reliably.
- Standard flowchart shapes and connector types are available.
- Styling controls work for shapes, text, and connectors.
- Snap, alignment, and distribution tools work predictably.
- Basic templates are included.
- Performance is acceptable on real Windows ARM hardware.
- Accessibility and keyboard usability have been reviewed.
- Installer or packaged app is ready for distribution.


---

## Appendix A: Version Management (added during implementation)

> This appendix was added to the original brief when the project was set up.
> It records how versions are managed for this codebase, consistent with the
> brief's non-functional requirements (versioned document schema, §13). The
> full contributor-facing instructions live in [VERSIONING.md](VERSIONING.md).

1. **Application versioning** follows [Semantic Versioning 2.0.0](https://semver.org)
   (`MAJOR.MINOR.PATCH`). The version is kept in sync across `package.json`,
   `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
2. **Document schema versioning** is independent of the app version: the
   `.flowshark` file format carries an integer `schemaVersion`
   (see `src/model/serialization.ts`). Older documents are migrated forward on
   load; documents from a newer schema are rejected with a clear message.
3. **Every user-facing change** is recorded in [CHANGELOG.md](CHANGELOG.md)
   following the [Keep a Changelog](https://keepachangelog.com) format.
4. **Releases** are cut by tagging `vMAJOR.MINOR.PATCH`; CI builds Windows
   ARM64 and x64 installers and attaches them to a draft GitHub release.
