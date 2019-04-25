<p align="center">
  <img src="https://github.com/mdbarr/dapper/blob/master/logo.svg" width="25%" title="Bow Tie by HeadsOfBirds from the Noun Project">
</p>

# dapper
Schema-less LDAP and Radius Server for small organizations

## Install
```bash
yarn install

# When not running in docker:
sudo setcap cap_net_raw,cap_net_bind_service=+ep `which node`
```
