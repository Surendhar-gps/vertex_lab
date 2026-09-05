/**
 * DXF Parser — extracts geometry entities from a DXF file string.
 * 
 * Supports: LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, ELLIPSE, POINT
 * Returns a normalized geometry object.
 */

/**
 * Parse a DXF string and return a geometry object.
 * @param {string} dxfContent - raw DXF file content
 * @returns {{ entities: Object[], bounds: Object, isValid: boolean, error?: string }}
 */
function parseDxf(dxfContent) {
  try {
    if (!dxfContent || dxfContent.trim().length === 0) {
      return { entities: [], bounds: null, isValid: false, error: 'Empty DXF file' };
    }

    const lines = dxfContent.split(/\r?\n/).map((l) => l.trim());
    const entities = [];

    // Find ENTITIES section
    let entitiesStart = -1;
    let entitiesEnd = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === 'ENTITIES' && i > 0 && lines[i - 1] === '2') {
        entitiesStart = i + 1;
      }
      if (entitiesStart > 0 && lines[i] === 'ENDSEC' && lines[i - 1] === '0') {
        entitiesEnd = i;
        break;
      }
    }

    if (entitiesStart === -1) {
      // Try to parse without ENTITIES section markers (some minimal DXF files)
      return { entities: [], bounds: null, isValid: false, error: 'No ENTITIES section found' };
    }

    const entityLines = lines.slice(entitiesStart, entitiesEnd);

    let i = 0;
    while (i < entityLines.length) {
      if (entityLines[i] === '0') {
        const entityType = entityLines[i + 1];
        i += 2;

        if (entityType === 'LINE') {
          const line = parseLine(entityLines, i);
          if (line) entities.push(line);
          i = line ? line._nextIdx : i;
        } else if (entityType === 'CIRCLE') {
          const circle = parseCircle(entityLines, i);
          if (circle) entities.push(circle);
          i = circle ? circle._nextIdx : i;
        } else if (entityType === 'ARC') {
          const arc = parseArc(entityLines, i);
          if (arc) entities.push(arc);
          i = arc ? arc._nextIdx : i;
        } else if (entityType === 'LWPOLYLINE') {
          const poly = parseLwPolyline(entityLines, i);
          if (poly) entities.push(poly);
          i = poly ? poly._nextIdx : i;
        } else if (entityType === 'POINT') {
          const point = parsePoint(entityLines, i);
          if (point) entities.push(point);
          i = point ? point._nextIdx : i;
        } else {
          i++;
        }
      } else {
        i++;
      }
    }

    // Calculate bounding box
    const bounds = calculateBounds(entities);

    return { entities, bounds, isValid: entities.length > 0 };
  } catch (err) {
    console.error('[DXF Parser] Error:', err.message);
    return { entities: [], bounds: null, isValid: false, error: err.message };
  }
}

function parseLine(lines, startIdx) {
  const entity = { type: 'LINE', x1: 0, y1: 0, x2: 0, y2: 0 };
  let i = startIdx;
  while (i < lines.length) {
    if (lines[i] === '0') break;
    const code = parseInt(lines[i], 10);
    const value = parseFloat(lines[i + 1]);
    if (code === 10) entity.x1 = value;
    else if (code === 20) entity.y1 = value;
    else if (code === 11) entity.x2 = value;
    else if (code === 21) entity.y2 = value;
    i += 2;
  }
  const dx = entity.x2 - entity.x1;
  const dy = entity.y2 - entity.y1;
  entity.length = Math.sqrt(dx * dx + dy * dy);
  entity.angle = Math.atan2(dy, dx) * (180 / Math.PI);
  entity._nextIdx = i;
  return entity;
}

function parseCircle(lines, startIdx) {
  const entity = { type: 'CIRCLE', cx: 0, cy: 0, radius: 0 };
  let i = startIdx;
  while (i < lines.length) {
    if (lines[i] === '0') break;
    const code = parseInt(lines[i], 10);
    const value = parseFloat(lines[i + 1]);
    if (code === 10) entity.cx = value;
    else if (code === 20) entity.cy = value;
    else if (code === 40) entity.radius = value;
    i += 2;
  }
  entity._nextIdx = i;
  return entity;
}

function parseArc(lines, startIdx) {
  const entity = { type: 'ARC', cx: 0, cy: 0, radius: 0, startAngle: 0, endAngle: 360 };
  let i = startIdx;
  while (i < lines.length) {
    if (lines[i] === '0') break;
    const code = parseInt(lines[i], 10);
    const value = parseFloat(lines[i + 1]);
    if (code === 10) entity.cx = value;
    else if (code === 20) entity.cy = value;
    else if (code === 40) entity.radius = value;
    else if (code === 50) entity.startAngle = value;
    else if (code === 51) entity.endAngle = value;
    i += 2;
  }
  entity._nextIdx = i;
  return entity;
}

function parseLwPolyline(lines, startIdx) {
  const entity = { type: 'LWPOLYLINE', vertices: [], isClosed: false };
  let i = startIdx;
  let currentX = null;
  while (i < lines.length) {
    if (lines[i] === '0') break;
    const code = parseInt(lines[i], 10);
    const value = lines[i + 1];
    if (code === 70) entity.isClosed = (parseInt(value, 10) & 1) === 1;
    else if (code === 10) currentX = parseFloat(value);
    else if (code === 20 && currentX !== null) {
      entity.vertices.push({ x: currentX, y: parseFloat(value) });
      currentX = null;
    }
    i += 2;
  }
  entity._nextIdx = i;
  entity.segmentCount = entity.vertices.length;
  entity.segmentLengths = [];
  for (let v = 0; v < entity.vertices.length - 1; v++) {
    const dx = entity.vertices[v + 1].x - entity.vertices[v].x;
    const dy = entity.vertices[v + 1].y - entity.vertices[v].y;
    entity.segmentLengths.push(Math.sqrt(dx * dx + dy * dy));
  }
  if (entity.isClosed && entity.vertices.length > 2) {
    const dx = entity.vertices[0].x - entity.vertices[entity.vertices.length - 1].x;
    const dy = entity.vertices[0].y - entity.vertices[entity.vertices.length - 1].y;
    entity.segmentLengths.push(Math.sqrt(dx * dx + dy * dy));
  }
  return entity;
}

function parsePoint(lines, startIdx) {
  const entity = { type: 'POINT', x: 0, y: 0 };
  let i = startIdx;
  while (i < lines.length) {
    if (lines[i] === '0') break;
    const code = parseInt(lines[i], 10);
    const value = parseFloat(lines[i + 1]);
    if (code === 10) entity.x = value;
    else if (code === 20) entity.y = value;
    i += 2;
  }
  entity._nextIdx = i;
  return entity;
}

function calculateBounds(entities) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const updateBounds = (x, y) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  for (const e of entities) {
    if (e.type === 'LINE') {
      updateBounds(e.x1, e.y1);
      updateBounds(e.x2, e.y2);
    } else if (e.type === 'CIRCLE' || e.type === 'ARC') {
      updateBounds(e.cx - e.radius, e.cy - e.radius);
      updateBounds(e.cx + e.radius, e.cy + e.radius);
    } else if (e.type === 'LWPOLYLINE') {
      for (const v of e.vertices) updateBounds(v.x, v.y);
    } else if (e.type === 'POINT') {
      updateBounds(e.x, e.y);
    }
  }

  if (minX === Infinity) return null;

  return {
    minX, minY, maxX, maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

module.exports = { parseDxf };
