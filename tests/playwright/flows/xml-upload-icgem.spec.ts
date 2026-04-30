/**
1. we parse all the entries like in the example data file: modelName: Model_2 etcetera. this happens in the test context!
1.1 we make sure that all the contents of the example data file are parsed
1.2 we input the info into the form
2. the form clicks save 
2.1 we make sure that the saved file has exactly the same content as iggem-grav.xml 
3. we click clear
3.1 we assert that absolutely all fields of the form are empty
4. we upload the example data file 
5. we assert that the values in the form are same as those in point 1.1 
 */
