import 'package:flutter/material.dart';

const kBg = Color(0xFF07130D);
const kGreen = Color(0xFF4ADE80);
const kLime = Color(0xFFA3E635);
const kRed = Color(0xFFF87171);
const kAmber = Color(0xFFFBBF24);
const kPanel = Color(0xE60B1F17);
const kCard = Color(0x14FFFFFF);
const kBorder = Color(0x1AFFFFFF);

ThemeData buildTheme() => ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: kBg,
      colorScheme: ColorScheme.fromSeed(seedColor: kGreen, brightness: Brightness.dark),
    );

InputDecoration inputDeco(String label) => InputDecoration(
      labelText: label,
      filled: true,
      fillColor: const Color(0x66000000),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
    );
