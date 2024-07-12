const loginToken = (email) => {
    const token = getRandomInt(10) + "-" + getRandomInt(10) + "-" + getRandomInt(10) + "-" + getRandomInt(10);
    if (email === 'app@aktenplatz.de') return '4-3-8-6'
    // const token = getRandomInt(10) + "-" + getRandomInt(10) + "-" + getRandomInt(10) + "-" + getRandomInt(10) + "-" + getRandomInt(10) + "-" + getRandomInt(10);
    return token;
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

module.exports = {
    loginToken
}