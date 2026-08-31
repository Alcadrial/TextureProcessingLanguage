# TextureProcessingLanguage

A DSL for manipulate images

## Types

The language accepts the following types:

- Number
- Boolean
- String
- Image
- Empty

The type String is used only as parameter or to locate an image.

Any variable of type String may be used in place of Image, in that case the string is resolved to
the FileSystem and the content of it's file is used.

Empty is a special type that represent an image with zero dimensions, can be used only with the Range and Resize operators and a value of this type can only be references using the built-in variable "empty".

Any variable is typed at initialization (may occur after declaration if using "var") and its type is fixed for its entire life-time, the only exceptions are Strings, Empties and Image, the first can change type to Image and the other two can change type to each other (conceptually a String may be resolved to an Image, an Empty is just a restricted Image)

## Language Features

The language support the following features:

- Var and Const declaration
- Auto typed variables at declaration
- Auto assignment operators (+=, -=, ...)
- IfElse
- While
- Functions
- Closures
- Print of strings and variables
- Stacktrace print
- Lazy resolution of images

## Operators

All classics arithmetic, logic and relational operators and the following image specific operators are supported.

### Range operator
image[x0,y0->x1,y1,color]

color is optional (defaults to fully transparent black)

### Resize operator
image{w,h,color}

color is optional (defaults to fully transparent black)

### Rotate operator
image @ angle

also !@

### Concat operator
image0 |> image1

also |< |^ |v |<v |<^ |>^ |>v

### Blend operator
image0 ** image1

### Flop operator
|image

### Sharpen operator
#image

## Built-in

### Variables

- empty:

  An image with zero size that cannot be created or modified, is used to create fixed color images of any size

### Functions

- width(image): Returns the width of the given image
- height(image): Returns the height of the given image

## Examples

In [this](examples/simple/) folder there are some example files named as "exampleN.tpl" where N is the id of the example, they can be easly run specifying "example=N" as program argument for the program.

### Example0

[Example 0](examples/simple/example0.tpl)

### Example1

TODO

### Example2

TODO

## Tests

In [this](examples/simple/) folder there are some test files named as "testN.tpl" where N is the id of the test, they can be easly run specifying "test=N" as program argument for the program.
