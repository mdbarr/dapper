# dapper
Schema-less LDAP and Radius Server for small organizations

## Install
```bash
yarn install

# When not running in docker:
sudo setcap cap_net_raw,cap_net_bind_service=+ep `which node`
```
