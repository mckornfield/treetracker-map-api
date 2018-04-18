var express = require('express');
var bodyParser = require('body-parser');
var http = require('http');
var pg = require('pg');
const { Pool, Client } = require('pg');
var path = require('path');
var app = express();
var port = process.env.PORT || 3000;
var conn = require('./config');

app.use(bodyParser.urlencoded({ extended: false })); // parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // parse application/json
app.set('view engine','html');

const pool = new Pool({

  connectionString: conn.connectionString
});


app.get('/trees', function(req, res){   
  console.log(req);

  let sql = "SELECT 'point' AS type, trees.* FROM trees WHERE active = true";
  let query = { 
    text: sql
  }

  if (req.query['zoom'] < 14) {
    let zoom = req.query['zoom'];
    let sql = "SELECT 'cluster' AS type, ST_AsGeoJSON(ST_Centroid(clustered_locations)) centroid, ST_AsGeoJSON(ST_MinimumBoundingCircle(clustered_locations)) circle, ST_NumGeometries(clustered_locations) count FROM ( SELECT unnest(ST_ClusterWithin(estimated_geometric_location, $1)) clustered_locations FROM trees WHERE active = true) clusters";
    query = {
      text : sql,
      values : [.01]
    }
  }

  pool.query(query)
    .then(function(data){
      res.status(200).json({              
        data: data.rows
      })
    })
  .catch(e => console.error(e.stack));

});

app.listen(port,()=>{
  console.log('listening on port ' + port);
});
