#da/*certo*/ ta//hello
   

operation merge(Image(t0, w, h) a, Image(t1, w, h) b, (t0, t1) -> t0 blend) {
    /*
    //a range value used to partially index an image
    //range r = [16, 16]->[w, h];
    for (v : r) {
        //lambda function shadows an eventual function/operation
        //a[v] = blend(a[v], b[v]);
    }
    //or extract a sub-image ("Image" is an alias for "Image(**)") run-time error if "r" is bigger than "a"
    Image a0 = a <@ r;
    //sub-image extraction with assignment (a <@= r) require that the image has 
    //unspecified bounds or the range is as big as the image
    for (v : *a0) {
        //a[v] = blend(a0[v], b[v]);
    }*/
    //embedding is also possible but a run-time error occurs if "r" is smaller than "a"
   // Image a1 = a >@ r;
    //with "@" no error occurs
  //  Image(**) a2 = a @ r;
}
