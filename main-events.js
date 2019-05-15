function deleteVertex (e) {
  if (curves[nearest_cont_bezier].points.length <= 1) {
    curves.splice(nearest_cont_bezier,1);
  } else {
    curves[nearest_cont_bezier].points.splice(nearest_cont_itr, 1);
  }
  draw();
};

function addVertex (e) {
  let mouse_obj = getMousePos(right_click_mouse_pos).slice(0, 2);

  // マウスの位置と線の距離が一定以下の場合は、線上に制御点を追加する
  // 一定以上の場合は、0とpoints.lengthの近い方にくっつける
  let min_length_to_line = 1000000;
  let nearest_to_line = 0;
  let added_b;
  for (let b = 0; b < curves.length; b++) {
    for (let i = 0; i < curves[b].points.length - 1; i++ ) {
      const v_a = numeric.sub(mouse_obj, curves[b].points[i]);
      const v_b = numeric.sub(curves[b].points[i+1], curves[b].points[i]);

      const dot_product = numeric.dot(v_a, v_b);
      const vec_length = numeric.div(dot_product, numeric.dot(v_b, v_b));

      if (vec_length > 1 || vec_length < 0) {
      } else {
        const vec_c = numeric.sub(numeric.mul(v_b, vec_length), v_a);
        const dot = numeric.dot(vec_c, vec_c);
        if (min_length_to_line > dot) {
          min_length_to_line = dot;
          nearest_to_line = i;
          added_b = b;
        }
      }
    }
  }

  curves[added_b].points.splice(nearest_to_line + 1, 0, mouse_obj);
  draw();
};

function newCurve (e) {
  curves.push(new Curve());
  const mouse_obj = getMousePos(right_click_mouse_pos).slice(0, 2);
  curves[curves.length - 1].points.push(mouse_obj);
  curves[curves.length - 1].points.push([mouse_obj[0] - 0.1, mouse_obj[1] - 0.1]);

  draw();
};

function splitCurve (e) {
  const cur_bez = curves[nearest_bez_bezier];
  const t = cur_bez.curve[nearest_bez_itr][1];

  let new_bez_1 = new Curve();
  let new_bez_2 = new Curve();
  curves.push(new_bez_1);
  curves.push(new_bez_2);

  for (let i = 0; i < cur_bez.points.length; i++) {
    new_bez_1.points.push(cur_bez.deCas(i, 0, t));
  }

  for (let i = 0; i < cur_bez.points.length; i++) {
    new_bez_2.points.push(cur_bez.deCas(cur_bez.points.length - i - 1, i, t));
  }

  curves.splice(nearest_bez_bezier, 1);

  draw();
};
