const DxfParser = require('dxf-parser');

/**
 * Parses a DXF string into a simplified geometric representation.
 * @param {string} dxfString
 * @returns {Object} Simplified object with arrays of entities (lines, circles, etc.)
 */
const parseDxf = (dxfString) => {
  try {
    const parser = new DxfParser();
    const dxf = parser.parseSync(dxfString);
    
    const entities = {
      lines: [],
      circles: [],
      arcs: [],
      lwpolylines: []
    };

    if (!dxf || !dxf.entities) return entities;

    // Filter and normalize entities
    dxf.entities.forEach(ent => {
      switch (ent.type) {
        case 'LINE':
          entities.lines.push({
            x1: ent.vertices[0].x,
            y1: ent.vertices[0].y,
            x2: ent.vertices[1].x,
            y2: ent.vertices[1].y,
            layer: ent.layer
          });
          break;
        case 'CIRCLE':
          entities.circles.push({
            cx: ent.center.x,
            cy: ent.center.y,
            r: ent.radius,
            layer: ent.layer
          });
          break;
        case 'ARC':
          entities.arcs.push({
            cx: ent.center.x,
            cy: ent.center.y,
            r: ent.radius,
            startAngle: ent.startAngle,
            endAngle: ent.endAngle,
            layer: ent.layer
          });
          break;
        case 'LWPOLYLINE':
          entities.lwpolylines.push({
            vertices: ent.vertices.map(v => ({ x: v.x, y: v.y })),
            closed: ent.shape,
            layer: ent.layer
          });
          break;
      }
    });

    return entities;
  } catch (error) {
    console.error('Error parsing DXF:', error);
    throw new Error('Failed to parse DXF file.');
  }
};

module.exports = { parseDxf };
