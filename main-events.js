function deleteVertex (e) {
  if (beziers[nearest_cont_bezier].points.length <= 1) {
    beziers.splice(nearest_cont_bezier,1);
  } else {
    beziers[nearest_cont_bezier].points.splice(nearest_cont_itr, 1);
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
  for (let b = 0; b < beziers.length; b++) {
    for (let i = 0; i < beziers[b].points.length - 1; i++ ) {
      const v_a = numeric.sub(mouse_obj, beziers[b].points[i]);
      const v_b = numeric.sub(beziers[b].points[i+1], beziers[b].points[i]);

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

  beziers[added_b].points.splice(nearest_to_line + 1, 0, mouse_obj);
  draw();
};

function newCurve (e) {
  beziers.push(new Bezier());
  const mouse_obj = getMousePos(right_click_mouse_pos).slice(0, 2);
  beziers[beziers.length - 1].points.push(mouse_obj);
  beziers[beziers.length - 1].points.push([mouse_obj[0] - 0.1, mouse_obj[1] - 0.1]);

  draw();
};

function splitCurve (e) {
  const cur_bez = beziers[nearest_bez_bezier];
  const t = cur_bez.curve[nearest_bez_itr][1];

  let new_bez_1 = new Bezier();
  let new_bez_2 = new Bezier();
  beziers.push(new_bez_1);
  beziers.push(new_bez_2);

  for (let i = 0; i < cur_bez.points.length; i++) {
    new_bez_1.points.push(cur_bez.deCas(i, 0, t));
  }

  for (let i = 0; i < cur_bez.points.length; i++) {
    new_bez_2.points.push(cur_bez.deCas(cur_bez.points.length - i - 1, i, t));
  }

  beziers.splice(nearest_bez_bezier, 1);

  draw();
};
