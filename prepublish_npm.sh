#!/bin/bash

if [ ! -f "packages" ]; then 
mkdir packages
fi
cd packages
if [ ! -f "tsc-cxx" ]; then
mkdir tsc-cxx
fi
cd tsc-cxx
if [ ! -f "lib" ]; then
mkdir lib
fi
if [ ! -f "bin" ]; then
mkdir bin
fi
if [ ! -f "cpplib" ]; then
mkdir cpplib
fi

cd ../..

rm "packages/tsc-cxx/lib/*.js"
rm "packages/tsc-cxx/lib/*.js.map"

rm "packages/tsc-cxx/cpplib/*.cpp"
rm "packages/tsc-cxx/cpplib/*.h"


tsc -p ./
cp __out/*.js "packages/tsc-cxx/lib"
cp __out/*.js.map "packages/tsc-cxx/lib"

cp cpplib/core.h "packages/tsc-cxx/cpplib"

cd ../..
