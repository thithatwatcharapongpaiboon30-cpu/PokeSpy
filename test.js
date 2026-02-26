const https = require('https');
https.get('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png', (res) => {
  console.log(res.statusCode);
});
