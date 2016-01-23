
// Wait for dom before loading
$(document).ready(function () {

    // Open up a pop-up page for oauth
    $("#signin").click(function () {
        var token = prompt('Please enter a token');

        setOauthToken(token);
        window.swagger.clientAuthorizations.authz.oauth2 = new SwaggerClient.ApiKeyAuthorization("Authorization",
                        "Bearer " + getOauthToken(), "header");
        getLastGlucose();
    });

    // Revoke token, clear it and log out
    $("#signout").click(function () {
        clearOauthToken();
        updateState("disconnected");
    });


    // Initialize swagger, point to a resource listing
    new SwaggerClient({
        url: "http://trident26.cl.datapipe.net/swagger/otr-api.yaml",
        authorizations : {

            // Required in test environment, remove this later
            httpbasic: new SwaggerClient.PasswordAuthorization("developer", "c0nn3ct"),

        },
        usePromise: true
    }).then(function (swagger) {

        // Save swagger for future use
        window.swagger = swagger;
        var token = getOauthToken();

        // Set oauth token for auth, and load data if already logged in
        if (token) {
            window.swagger.clientAuthorizations.authz.oauth2 =
            new SwaggerClient.ApiKeyAuthorization("Authorization", "Bearer " + token, "header");
            getLastGlucose();

        // Otherwise go to disconnect state
        } else {
            updateState("disconnected");
        }

        return swagger;
    }).catch(function(error) {
        console.error("Swagger promise rejected", error);
    });
});

// Update the app to a set state
function updateState(updateStateTo){

    // Show the selected state, hide all others
    ["disconnected", "loading", "lastglucose", "noglucose"].forEach(function (state) {

        if ( updateStateTo === state ) {
            $("#" + state).removeClass("hidden");
        } else {
            $("#" + state).addClass("hidden");
        }
    });

    // Set sign in appropriately based on current state
    if (localStorage.getItem("otr.oauth.token")) {
        $("#signin").addClass("hidden");
        $("#signout").removeClass("hidden");
    } else {
        $("#signin").removeClass("hidden");
        $("#signout").addClass("hidden");
    }
}

// Get the last glucose reading from the API and update the UI
function getLastGlucose() {
    updateState("loading");
    window.swagger["Health Data"].get_v1_patient_healthdata_search({
        startDate: moment().add(-89, "d").startOf("day").format("YYYY-MM-DDTHH:mm:ss"),
        endDate:   moment().add(1, "d").startOf("day").format("YYYY-MM-DDTHH:mm:ss"),
        type:      "bloodGlucose",
        limit:     5000
    }).then(function(searchResponse){

        if (searchResponse.obj.bloodGlucose && searchResponse.obj.bloodGlucose.length > 0) {
            var bgReading = searchResponse.obj.bloodGlucose[searchResponse.obj.bloodGlucose.length - 1];

            // Set the numeric value, units, and time
            $("#bgvalue").text(bgReading.bgValue.value);
            $("#uom").text(bgReading.bgValue.units);
            $("#bgtime").text(moment(bgReading.readingDate, "YYYY-MM-DDTHH:mm:ss").calendar());

            // Clear and reset style of reading based on range
            $("#bgvalue").removeClass("in-range below-target above-target");

            if ( bgReading.bgValue.value < 70 ) {
                $("#bgvalue").addClass("below-target");
            } else if ( bgReading.bgValue.value > 180 ) {
                $("#bgvalue").addClass("above-target");
            } else {
                $("#bgvalue").addClass("in-range");
            }

            updateState("lastglucose");
        } else {
            updateState("noglucose");
        }
    }).catch(function (error) {

        // Oauth token was invalid, clear it and go to disconnected
        if (errror.status === 401) {
            clearOauthToken();
            updateState("disconnected");

        // Pop error
        } else {
            console.error("Could not fetch readings", error);
        }
    });
}

// Keep the oauth token in local storage
function setOauthToken(token) {
    localStorage.setItem("otr.oauth.token", token);
}

// Remove the token from storage and also revoke it in the api
function clearOauthToken() {
    var token = getOauthToken();
    localStorage.removeItem("otr.oauth.token", token);
}

function getOauthToken() {
    return localStorage.getItem("otr.oauth.token");
}



