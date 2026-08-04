#onChannelOverflow error

//Function declaration: only read-only operation on textures are allowed
boolean isBooleanTexture(Image(t, **) texture) {

    return t == boolean;
}

//Operation declaration: allow operations that modify the given textures
operation clip(Image(RGBA, *, *) image, Image(boolean, *, *) mask) {

    //loop by exploded multi-indices inside the valid bounds of "image"
    for ([i, j] : *image) {
        //indexing using a multi-index 
        //out of bounds indexing results in the "null" value appropriate for the image format ("false" in this case)
        if (!mask[[j, i]]) {
            image[[i, j]] = 0;
        }
    }
    //loop for indices valid for both "image" and "mask" using intersection "&&"
    for ([i, j] : *image && *mask) {
        //convenience multi-indexing with a single bracket
        if (!mask[j, i]) {
            image[i, j] = 0;
        }
    }
    //loop by multi-index (v = [i, j])
    for (v : *image) {
        //format's channels referenced object-style ("channel" is the type representing the color value aka float in range [0;1])
        channel pixel = image[v].a;
        //multichannel copy
        image[v].rgb = [pixel, pixel, pixel];
        image[v].a = 1;
    }
}
//Implicit type definitions "t", "w", "h" must match for each of "a", "b", "c" and "dst"
operation fma(Image(t, w, h) a, Image(t, w, h) b, Image(t, w, h) c, Image(t, w, h) dst) {

    dst = a * b + c;
}

operation merge(Image(t0, w, h) a, Image(t1, w, h) b, (t0, t1) -> t0 blend) {
    
    //a range value used to partially index an image
    range r = [16, 16]->[w, h];
    for (v : r) {
        //lambda function shadows an eventual function/operation
        a[v] = blend(a[v], b[v]);
    }
    //or extract a sub-image ("Image" is an alias for "Image(**)") run-time error if "r" is bigger than "a"
    Image a0 = a <@ r;
    //sub-image extraction with assignment (a <@= r) require that the image has 
    //unspecified bounds or the range is as big as the image
    for (v : *a0) {
        a[v] = blend(a0[v], b[v]);
    }
    //embedding is also possible but a run-time error occurs if "r" is smaller than "a"
    Image a1 = a >@ r;
    //with "@" no error occurs
    Image a2 = a @ r;
}

Image(RGBA, 256, 256) image = empty;
//Unknown type, width and height, but must be a 2D Image
Image(*, *, *) mask = file("mask.png");

if (!isBooleanTexture(mask)) {
    //equivalent usage of '' and ""
    print('Error: the file "mask.png" is not a boolean texture');
    //terminates execution and revert every operation done so far
    abort;
}

//run-time error if the type of each parameter is not compatible with the definition of "clip"
clip(image, mask);

//write "image" to disk in file "out.png"
write image "out.png";

//show grafically the image in a new window
show image;
