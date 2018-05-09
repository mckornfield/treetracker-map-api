var express = require('express');
var bodyParser = require('body-parser');
var http = require('http');
var pg = require('pg');
const { Pool, Client } = require('pg');
var path = require('path');
var app = express();
var port = process.env.NODE_PORT || 3000;
var conn = require('./config');

app.use(bodyParser.urlencoded({ extended: false })); // parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // parse application/json
app.set('view engine', 'html');

const pool = new Pool({
  connectionString: conn.connectionString
});


app.get('/trees', function (req, res) {
  console.log(req);

  let token = req.query['token'];
  let organization = req.query['organization'];
  let join = '';
  let joinCriteria = '';
  if (token) {
    join = "INNER JOIN certificates ON trees.certificate_id = certificates.id AND certificates.token = '" + token + "'";
  } else if(organization) {
    join = ", certificates, donors, organizations";
    joinCriteria = "AND trees.certificate_id = certificates.id AND certificates.donor_id = donors.id AND donors.organization_id = organizations.id AND organizations.id = " + organization;
  }

  let bounds = req.query['bounds'];
  let boundingBoxQuery = '';
  if (bounds) {
    boundingBoxQuery = 'AND trees.estimated_geometric_location && ST_MakeEnvelope(' + bounds + ', 4326)';
  }

  let clusterRadius = parseFloat(req.query['clusterRadius']);
  console.log(clusterRadius);
  var sql, query
  if (clusterRadius <= 0.001) {
    sql = "SELECT 'point' AS type, trees.*, users.first_name as first_name, users.last_name as last_name, users.image_url as user_image_url FROM trees INNER JOIN users ON users.id = trees.user_id " + join + " WHERE active = true " + boundingBoxQuery + joinCriteria;
    query = {
      text: sql
    }
  }
  else {
    sql = `SELECT 'cluster'                                                   AS type, 
                    St_asgeojson(St_centroid(clustered_locations))                 centroid, 
                    --St_asgeojson(St_minimumboundingcircle(clustered_locations))    circle, 
                    St_numgeometries(clustered_locations)                          count 
             FROM   ( 
                        SELECT Unnest(St_clusterwithin(estimated_geometric_location, $1)) clustered_locations
                        FROM   trees ` + join + ` 
                        WHERE  active = true ` + boundingBoxQuery + joinCriteria + ` ) clusters`;
    query = {
      text: sql,
      values: [clusterRadius]
    }
  }

  pool.query(query)
    .then(function (data) {
      res.status(200).json({
        data: data.rows
      })
    })
    .catch(e => console.error(e.stack));

});

app.listen(port, () => {
  console.log('listening on port ' + port);
});
