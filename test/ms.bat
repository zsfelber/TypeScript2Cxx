call "C:\Program Files (x86)\Microsoft Visual Studio\2017\Community\Common7\Tools\VsDevCmd.bat"
cl /EHsc /MD /std:c++latest /I..\Playground ..\Playground\core.cpp test.cpp
