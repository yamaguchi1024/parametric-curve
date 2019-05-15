// Combination
function productRange (a,b) {
  let prd = a;
  let i = a;
  while (i++< b) {
    prd*=i;
  }
  return prd;
}

function combinations(n, r) {
  if (n==r) {
    return 1;
  } else {
    r=(r < n-r) ? n-r : r;
    return productRange(r+1, n)/productRange(1,n-r);
  }
}

function getMousePos (mouse_win) {
  mouse_win.push(1);

  let mouse_obj = glu.unproject(mouse_win, 
    legacygl.uniforms.modelview.value,
    legacygl.uniforms.projection.value,
    [0, 0, canvas.width, canvas.height]);

  // just reuse the same code as the 3D case
  let plane_origin = [0, 0, 0];
  let plane_normal = [0, 0, 1];
  let eye_to_mouse = numeric.sub(mouse_obj, camera.eye);
  let eye_to_origin = numeric.sub(plane_origin, camera.eye);
  let s1 = numeric.dot(eye_to_mouse, plane_normal);
  let s2 = numeric.dot(eye_to_origin, plane_normal);
  return eye_to_intersection = numeric.mul(s2 / s1, eye_to_mouse);

}

function findNearestPoint (mouse_win) {
  let viewport = [0, 0, canvas.width, canvas.height];
  let dist_min = 10000000;
  let nearest_itr;
  let nearest_point;
  let nearest_bezier;
  for (let b = 0; b < curves.length; b++) {
    for (let i = 0; i < curves[b].points.length; ++i) {
      let object_win = glu.project([curves[b].points[i][0], curves[b].points[i][1], 0], 
        legacygl.uniforms.modelview.value,
        legacygl.uniforms.projection.value,
        viewport);
      let dist = vec2.dist(mouse_win, object_win);
      if (dist < dist_min) {
        dist_min = dist;
        nearest_itr = i;
        nearest_bezier = b;
        nearest_point = curves[b].points[i];
      }
    }
  }

  return [nearest_bezier, nearest_itr, nearest_point];
}

function findNearestCurve (mouse_win) {
  let viewport = [0, 0, canvas.width, canvas.height];
  let dist_min = 10000000;
  let nearest_itr;
  let nearest_point;
  let nearest_bezier;
  for (let b = 0; b < curves.length; b++) {
    for (let i = 0; i < curves[b].curve.length; ++i) {
      let object_win = glu.project([curves[b].curve[i][0], curves[b].curve[i][1], 0], 
        legacygl.uniforms.modelview.value,
        legacygl.uniforms.projection.value,
        viewport);
      let dist = vec2.dist(mouse_win, object_win);
      if (dist < dist_min) {
        dist_min = dist;
        nearest_itr = i;
        nearest_bezier = b;
        nearest_point = curves[b].curve[i];
      }
    }
  }

  return [nearest_bezier, nearest_itr, nearest_point];
}
