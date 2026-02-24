# Plan for reduction print designer

## Overview

Reduction Print Designer is software that is used to plan reduction block prints.

The software is fully end to end - from importing of an image or photo through the design of each layer.

## Modules

The workflow of the sofware should be broken into modules that work independently.

An overview of the modules.

* Import - Ingest an image file.
* Quantization - quantize the image to a limited number of colors based on the number of layers desired
* Layer design - suggesting and adusting the order of the layering, using heuristics.
* Design - modify the borders between colors to match the types of marks that can be made with traditional
carving tools - u-gouges, v-gouges, a knife, etc.
* Orientation - mirroring the image to aid in image transfer onto the plate to the resulting image is back in the correct orientation
* Layer creation - separating the colors into layers, starting at the last layer (usually black) which is the details,
then creating the underlying layers which consist of the current layer plus all layers above.
* Export - the ability to export the images as layers for transfer.

## Technical Requirements

* Storage - IndexedDB for project persistence in the browser
* Projects - save and open projects.
* Web app - fully client-side, deployable to any static host
* Offline - all transformations run locally in the browser
