import 'package:flutter/material.dart';

import 'theme.dart';

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

String pad2(int n) => n.toString().padLeft(2, '0');
String posId(String g, int p, int c, int r) => '$g-P${pad2(p)}-C${pad2(c)}-R${pad2(r)}';

String fmtDate(Object? iso) {
  if (iso == null) return '—';
  final d = DateTime.tryParse(iso.toString());
  if (d == null) return iso.toString();
  final l = d.toLocal();
  return '${l.day} ${_months[l.month - 1]} ${l.year}, ${pad2(l.hour)}:${pad2(l.minute)}';
}

String fmtDay(Object? iso) => iso == null ? '—' : iso.toString().split('T').first;

String infoText(Object? info) => (info is Map && info.isNotEmpty) ? info.toString() : '';

class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;
  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.onTap});

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(16);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: kCard,
        shape: RoundedRectangleBorder(borderRadius: radius, side: const BorderSide(color: kBorder)),
        child: InkWell(borderRadius: radius, onTap: onTap, child: Padding(padding: padding, child: child)),
      ),
    );
  }
}

class ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  const ErrorView({super.key, required this.message, this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: kRed)),
            if (onRetry != null) TextButton(onPressed: onRetry, child: const Text('Try again')),
          ]),
        ),
      );
}

class Loading extends StatelessWidget {
  const Loading({super.key});
  @override
  Widget build(BuildContext context) => const Center(child: CircularProgressIndicator(color: kGreen));
}

Widget heading(String text) => Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 8),
      child: Text(text, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
    );

Widget label(String k, String v) => Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text.rich(TextSpan(children: [
        TextSpan(text: '$k  ', style: const TextStyle(color: Colors.white54)),
        TextSpan(text: v),
      ])),
    );

/// Asks for one or more text values. Returns null if cancelled.
Future<List<String>?> promptDialog(BuildContext context, String title, List<String> labels) {
  final controllers = labels.map((_) => TextEditingController()).toList();
  return showDialog<List<String>>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(title),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < labels.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: TextField(controller: controllers[i], decoration: inputDeco(labels[i])),
            ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c), child: const Text('Cancel')),
        FilledButton(onPressed: () => Navigator.pop(c, controllers.map((e) => e.text.trim()).toList()), child: const Text('OK')),
      ],
    ),
  );
}

Future<bool> confirmDialog(BuildContext context, String title, String text) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(title),
      content: Text(text),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
        FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Yes')),
      ],
    ),
  );
  return ok == true;
}

void toast(BuildContext context, String text) =>
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
