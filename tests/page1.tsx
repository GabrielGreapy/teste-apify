"use client"


declare global {
    interface Window {
        google : any
    }
}



import { useEffect, useRef } from "react"



export default function Home(){

    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if(!apiKey) return;

        const initAutoComplete  = () => {
            if(!inputRef.current || !window.google) return
            const autoComplete = new window.google.maps.places.Autocomplete(
                inputRef.current, {
                    types : ["geocode", "establishment"],
                }
            )
            autoComplete.addListener( "place_changed", () => {
                const place = autoComplete.getPlace();
                if(!place.geometry || !place.geometry.location) return;
                console.log("Place changed to " + place)
            })


        }
         
        
        if(window.google){
            initAutoComplete();
            return
        }
        const scriptExistence = document.querySelector('script[src*="maps.googleapis.com"]')
        if(scriptExistence){
            scriptExistence.addEventListener("load" , initAutoComplete)
            return
        }

        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.onload = initAutoComplete;
        document.head.appendChild(script)


    }, [])

    return(

        <input type="text" 
            ref={inputRef}
        />


    )
}