Jester --- A discord AI radio host

To get an Youtube API key
https://developers.google.com/youtube/v3/getting-started

just need to run in docker container with gpu pass through


##ADDING CUSTOM ADS

If you want to add normal ads or custom ads, make an array for either adMap or normalAds in config
and then add objects into the array with the format 
{
    "name": The name you want as a string,
    "fileLocation" : realtive or absolute file location as a string,
    "length" : Length of ad in seconds
}


##ADDING INTRO AND OUTRO
To add an intro or outro just go to intro or outro in config and add a object in the format
{
    "fileLocation" : realtive or absolute file location as a string,
    "length" : Length of intro/outro in seconds
}
