import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  UserOutlined,
  AntDesignOutlined,
  ProfileFilled,
  MoneyCollectFilled,
  HistoryOutlined,
} from '@ant-design/icons';

export const sidebarItems = [
  {
    key: 'Dashboard',
    label: <NavLink to='/'>DASHBOARD</NavLink>,
    icon: React.createElement(ProfileFilled),
  },
  {
    key: 'Add Flower',
    label: <NavLink to='/create-product'>ADD FLOWER</NavLink>,
    icon: React.createElement(AntDesignOutlined),
  },
  {
    key: 'Manage Flowers',
    label: <NavLink to='/products'>MANAGE FLOWERS</NavLink>,
    icon: React.createElement(MoneyCollectFilled),
  },
  {
    key: 'All Sales',
    label: <NavLink to='/sales'>ALL SALES</NavLink>,
    icon: React.createElement(HistoryOutlined),
  },
  {
    key: 'Sales History',
    label: <NavLink to='/sales-history'>SALES HISTORY</NavLink>,
    icon: React.createElement(HistoryOutlined),
  },
  {
    key: 'Profile',
    label: <NavLink to='/profile'>PROFILE</NavLink>,
    icon: React.createElement(UserOutlined),
  },
];