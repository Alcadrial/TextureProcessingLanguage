#da/*certo*/ ta//hello
   

Image(RGBA, 256, 256) image = empty;
//Unknown type, width and height, but must be a 2D Image
Image(*, *, *) mask = file("mask.png");

   print('Error: the file "mask.png" is not a boolean texture');
if (!isBooleanTexture(mask)) {
    //equivalent usage of '' and ""
    //terminates execution and revert every operation done so far
    abort;
}


//run-time error if the type of each parameter is not compatible with the definition of "clip"
clip(image, mask);

//write "image" to disk in file "out.png"
write(image, "out.png");

//show grafically the image in a new window
show(image);

//same as "show(image)" but also terminate execution
return image;
