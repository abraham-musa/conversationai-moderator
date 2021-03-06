/*
Copyright 2019 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { connect } from 'react-redux';
import { Redirect, Route, Switch } from 'react-router';

import { IAppState } from '../appstate';
import { SplashRoot } from '../components';
import { getCurrentUserIsAdmin } from '../stores/users';
import {
  Comments,
  TagSelector,
} from './Comments';
import {
  dashboardBase,
  searchBase,
  settingsBase,
  tagSelectorBase,
} from './routes';
import { Search } from './Search';
import { Settings } from './Settings';
import { TableFrame } from './Tables/TableFrame';

function redirect(to: string) {
  return () => {
    return <Redirect to={to}/>;
  };
}

function _AppRoot(props: {isAdmin: boolean}) {
  return (
    <Switch>
      <Route exact path="/" render={redirect(`/${dashboardBase}`)} />
      <Route path={`/${dashboardBase}/:filter?/:sort?`} component={TableFrame}/>
      {props.isAdmin &&
      <Route path={`/${settingsBase}`} component={Settings}/>
      }
      <Route path={`/${searchBase}`} component={Search}/>
      <Route path={`/${tagSelectorBase}/:context/:contextId/:tag`} component={TagSelector} />
      <Route path={'/:context/:contextId'} component={Comments}/>
      <Route path={'/'} component={SplashRoot}/>
    </Switch>
  );
}

// TODO: Replace with a hook when we upgrade react-redux and fixed type errors.
export const AppRoot = connect((state: IAppState) => {
  return {
    isAdmin: getCurrentUserIsAdmin(state),
  };
})(_AppRoot);
